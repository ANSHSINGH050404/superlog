import {
  AGENT_CONTENT_BOUNDARY_VERSION,
  wrapUntrustedContent,
  wrapUntrustedJsonValue,
} from "../../agent-content-boundary.js";
import type {
  AgentChatStartInput,
  AgentRunnerBackend,
  AgentRunnerModelBackend,
  AgentRunnerModelStartInput,
  AgentRunnerStartInput,
} from "../../agent-runner-backend.js";
import { communityRunnerBackend } from "./community.js";

type AgentRunnerModule = {
  default?: unknown;
  agentRunnerBackend?: unknown;
};

let anthropicRunnerBackend: { specifier: string; backend: Promise<AgentRunnerBackend> } | null =
  null;

const disabledRunnerBackend: AgentRunnerBackend = {
  name: "disabled",
  maxRepoResources: 0,
  async start() {
    throw new Error("agent runner backend is disabled");
  },
  async terminate() {
    throw new Error("agent runner backend is disabled");
  },
  async startChat() {
    throw new Error("agent runner backend is disabled");
  },
  async sendChatMessage() {
    throw new Error("agent runner backend is disabled");
  },
  async collect() {
    throw new Error("agent runner backend is disabled");
  },
  async resume() {
    throw new Error("agent runner backend is disabled");
  },
  async steer() {
    throw new Error("agent runner backend is disabled");
  },
  async dispatchIntegrationToolCalls() {
    return 0;
  },
  async dispatchChatToolCalls() {
    return { handled: 0, repliesThisTurn: 0 };
  },
};

export async function getAgentRunnerBackend(runtime: string): Promise<AgentRunnerBackend> {
  if (runtime === "community") return communityRunnerBackend;
  if (runtime === "disabled") return disabledRunnerBackend;
  if (runtime === "anthropic") {
    return loadConfiguredRunner("anthropic", "AGENT_RUNNER_ANTHROPIC_MODULE");
  }
  throw new Error(`unsupported agent runner backend: ${runtime}`);
}

async function loadConfiguredRunner(
  runtime: string,
  moduleEnvName: string,
): Promise<AgentRunnerBackend> {
  const specifier = process.env[moduleEnvName];
  if (!specifier) {
    throw new Error(`${moduleEnvName} is required to use the ${runtime} agent runner backend`);
  }
  if (!anthropicRunnerBackend || anthropicRunnerBackend.specifier !== specifier) {
    anthropicRunnerBackend = {
      specifier,
      backend: importRunnerModule(specifier, runtime),
    };
  }
  return anthropicRunnerBackend.backend;
}

async function importRunnerModule(specifier: string, runtime: string): Promise<AgentRunnerBackend> {
  const mod = (await import(specifier)) as AgentRunnerModule;
  const backend = mod.agentRunnerBackend ?? mod.default;
  if (!isAgentRunnerBackend(backend)) {
    throw new Error(
      `configured ${runtime} agent runner module must export an AgentRunnerBackend as agentRunnerBackend or default`,
    );
  }
  if (backend.contentBoundaryVersion !== AGENT_CONTENT_BOUNDARY_VERSION) {
    throw new Error(
      `configured ${runtime} runner must implement the ${AGENT_CONTENT_BOUNDARY_VERSION} external-content boundary contract`,
    );
  }
  return enforceExternalContentBoundary(backend);
}

function enforceExternalContentBoundary(backend: AgentRunnerModelBackend): AgentRunnerBackend {
  const recover = backend.recover?.bind(backend);
  const classifyDeliveryError = backend.classifyDeliveryError?.bind(backend);
  const interrupt = backend.interrupt?.bind(backend);
  return {
    name: backend.name,
    maxRepoResources: backend.maxRepoResources,
    contentBoundaryVersion: backend.contentBoundaryVersion,
    start: (input) => backend.start(boundStartInput(input)),
    terminate: (sessionId) => backend.terminate(sessionId),
    startChat: (input) => backend.startChat(boundChatInput(input)),
    sendChatMessage: (sessionId, message) =>
      backend.sendChatMessage(sessionId, wrapUntrustedContent(message)),
    collect: (sessionId) => backend.collect(sessionId),
    resume: (sessionId, message) => backend.resume(sessionId, wrapUntrustedContent(message)),
    steer: (sessionId, message, trust) =>
      backend.steer(
        sessionId,
        trust === "external" ? wrapUntrustedContent(message) : message,
        trust,
      ),
    ...(recover
      ? {
          recover: (sessionId, input) => recover(sessionId, input),
        }
      : {}),
    ...(classifyDeliveryError
      ? { classifyDeliveryError: (err) => classifyDeliveryError(err) }
      : {}),
    ...(interrupt ? { interrupt: (sessionId) => interrupt(sessionId) } : {}),
    dispatchIntegrationToolCalls: (input) => backend.dispatchIntegrationToolCalls(input),
    dispatchChatToolCalls: (input) => backend.dispatchChatToolCalls(input),
  };
}

function boundStartInput(input: AgentRunnerStartInput): AgentRunnerModelStartInput {
  return {
    ...input,
    title: wrapUntrustedContent(input.title),
    service: boundNullable(input.service),
    issueSummaries: input.issueSummaries.map(wrapUntrustedJsonValue),
    repoCandidates: input.repoCandidates.map(boundRepoCandidate),
    customPrompt: boundNullable(input.customPrompt),
    prBaseBranch: boundNullable(input.prBaseBranch),
    memories: input.memories.map((memory) => ({
      ...memory,
      title: wrapUntrustedContent(memory.title),
      body: wrapUntrustedContent(memory.body),
    })),
    followUp: input.followUp
      ? {
          ...input.followUp,
          interactions: input.followUp.interactions.map((interaction) => ({
            ...interaction,
            author: boundNullable(interaction.author),
            text: wrapUntrustedContent(interaction.text),
            path: boundNullable(interaction.path),
          })),
          priorRun: input.followUp.priorRun
            ? {
                ...input.followUp.priorRun,
                summary: wrapUntrustedContent(input.followUp.priorRun.summary),
                rootCause: boundNullable(input.followUp.priorRun.rootCause),
                handoffNotes: boundNullable(input.followUp.priorRun.handoffNotes),
                validationSummary: boundNullable(input.followUp.priorRun.validationSummary),
              }
            : null,
          timeline: input.followUp.timeline.map(wrapUntrustedContent),
        }
      : null,
    predecessors: input.predecessors.map((predecessor) => ({
      ...predecessor,
      title: wrapUntrustedContent(predecessor.title),
      resolvedReasonText: boundNullable(predecessor.resolvedReasonText),
      agentSummary: boundNullable(predecessor.agentSummary),
      rootCauseText: boundNullable(predecessor.rootCauseText),
      handoffNotes: boundNullable(predecessor.handoffNotes),
    })),
  };
}

function boundChatInput(input: AgentChatStartInput): AgentChatStartInput {
  return {
    ...input,
    projectName: wrapUntrustedContent(input.projectName),
    question: wrapUntrustedContent(input.question),
    requester: boundNullable(input.requester),
    repoCandidates: input.repoCandidates.map(boundRepoCandidate),
    memories: input.memories.map((memory) => ({
      ...memory,
      title: wrapUntrustedContent(memory.title),
      body: wrapUntrustedContent(memory.body),
    })),
  };
}

function boundRepoCandidate(
  repo: AgentRunnerStartInput["repoCandidates"][number],
): AgentRunnerStartInput["repoCandidates"][number] {
  return {
    ...repo,
    fullName: safeRepositoryFullName(repo.fullName),
    instructionFiles: repo.instructionFiles.map(wrapUntrustedContent),
  };
}

function safeRepositoryFullName(fullName: string): string {
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/iu.test(fullName)) {
    throw new Error("configured model runtime received an unsafe repository identifier");
  }
  return fullName;
}

function boundNullable(value: string | null): string | null;
function boundNullable(value: string | null | undefined): string | null | undefined;
function boundNullable(value: string | null | undefined): string | null | undefined {
  return value == null ? value : wrapUntrustedContent(value);
}

function isAgentRunnerBackend(value: unknown): value is AgentRunnerModelBackend {
  if (!value || typeof value !== "object") return false;
  const backend = value as Partial<AgentRunnerBackend>;
  return (
    typeof backend.name === "string" &&
    typeof backend.maxRepoResources === "number" &&
    typeof backend.start === "function" &&
    typeof backend.terminate === "function" &&
    typeof backend.startChat === "function" &&
    typeof backend.sendChatMessage === "function" &&
    typeof backend.collect === "function" &&
    typeof backend.resume === "function" &&
    typeof backend.steer === "function" &&
    typeof backend.dispatchIntegrationToolCalls === "function" &&
    typeof backend.dispatchChatToolCalls === "function"
  );
}
