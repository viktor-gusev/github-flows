declare global {
  type Github_Flows_Event_Logging_Context__Data = {
    eventId: string,
    eventType: string,
    logDirectory: string,
    owner: string,
    repo: string,
  };
  type Github_Flows_Event_Logging_Context = import("./src/Event/Logging/Context.mjs").default;
  type Github_Flows_Event_Attribute__Value = null | boolean | number | string;
  type Github_Flows_Event_Attribute__Set = Record<string, Github_Flows_Event_Attribute__Value>;
  type Github_Flows_Event_Attribute_Provider__Input = {
    eventModel: Github_Flows_Event_Model__Data,
    headers?: Record<string, string | string[] | undefined>,
    loggingContext?: Github_Flows_Event_Logging_Context__Data,
    payload: unknown,
  };
  type Github_Flows_Event_Attribute_Provider = {
    getAttributes(input: Github_Flows_Event_Attribute_Provider__Input):
      Promise<Partial<Github_Flows_Event_Attribute__Set> | undefined>
      | Partial<Github_Flows_Event_Attribute__Set>
      | undefined,
  };
  type Github_Flows_Event_Model__Repository = {
    fullName: string | undefined,
    name: string | undefined,
    ownerLogin: string | undefined,
  };
  type Github_Flows_Event_Model__Data = {
    action: string | undefined,
    actorLogin: string | undefined,
    deliveryId: string | undefined,
    event: string | undefined,
    repository: Github_Flows_Event_Model__Repository,
  };
  type Github_Flows_Event_Model_Builder__Result = {
    attributes: Record<string, string | undefined>,
    event: Github_Flows_Event_Model__Data,
  };
  type Github_Flows_Event_Model_Builder = import("./src/Event/Model/Builder.mjs").default;
  type Github_Flows_Event_Attribute_Provider_Holder = import("./src/Event/Attribute/Provider/Holder.mjs").default;
  type Github_Flows_Event_Attribute_Resolver__Result = {
    additionalAttributes: Github_Flows_Event_Attribute__Set,
    baseAttributes: Record<string, string | undefined>,
    eventModel: Github_Flows_Event_Model__Data,
    eventAttributes: Record<string, Github_Flows_Event_Attribute__Value | undefined>,
    providerUsed: boolean,
  };
  type Github_Flows_Event_Attribute_Resolver = import("./src/Event/Attribute/Resolver.mjs").default;
  type Github_Flows_Web_Handler_Webhook_EventLog__Value =
    | null
    | boolean
    | number
    | string
    | Github_Flows_Web_Handler_Webhook_EventLog__Value[]
    | { [key: string]: Github_Flows_Web_Handler_Webhook_EventLog__Value };
  type Github_Flows_Web_Handler_Webhook_EventLog__GithubHeaderName =
    | `x-github-${string}`
    | `x-hub-${string}`;
  type Github_Flows_Web_Handler_Webhook_EventLog__Headers =
    Partial<Record<Github_Flows_Web_Handler_Webhook_EventLog__GithubHeaderName, string | string[]>>;
  type Github_Flows_Web_Handler_Webhook_EventLog__ReceptionEntry = {
    type: "github-webhook";
    stage: "reception";
    pathname: "...";
    headers: Github_Flows_Web_Handler_Webhook_EventLog__Headers;
    body: Github_Flows_Web_Handler_Webhook_EventLog__Value;
  };
  type Github_Flows_Web_Handler_Webhook_EventLog__IngressEntry = {
    type: "github-webhook";
    stage: "ingress";
    outcome: string;
    reason?: Github_Flows_Web_Handler_Webhook_EventLog__Value;
  };
  type Github_Flows_Web_Handler_Webhook_EventLog__DecisionTraceEntry = {
    type: "github-webhook";
    stage: "decision-trace";
    resolutionInputs: Github_Flows_Web_Handler_Webhook_EventLog__Value;
    decisionBasis: Github_Flows_Web_Handler_Webhook_EventLog__Value;
    decision: string;
  };
  type Github_Flows_Web_Handler_Webhook_EventLog__SnapshotEntry = {
    headers: Github_Flows_Web_Handler_Webhook_EventLog__Headers;
    body: unknown;
  };
  type Github_Flows_Web_Handler_Webhook_EventLog__ArchivalEntry = {
    type: "github-flows" | "github-webhook";
    stage: string;
    loggedAt: string;
    component?: string;
    action?: string;
    details?: unknown;
    message?: string;
    decision?: string;
    resolutionInputs?: Github_Flows_Web_Handler_Webhook_EventLog__Value;
    decisionBasis?: Github_Flows_Web_Handler_Webhook_EventLog__Value;
  };
  type Github_Flows_Logger__ComponentActionEntry = {
    type: "github-flows";
    stage: "component-action";
    component: string;
    action: string;
    details?: unknown;
    message: string;
  };
  type Github_Flows_Config_Runtime = import("./src/Config/Runtime.mjs").Data;
  type Github_Flows_Config_Runtime__Wrapper = import("./src/Config/Runtime.mjs").default;
  type Github_Flows_Config_Runtime__Factory = import("./src/Config/Runtime.mjs").Factory;
  type Github_Flows_Execution_Handler_Type = "agent" | "shell";
  type Github_Flows_Execution_Profile__Execution = {
    handler: {
      type: Github_Flows_Execution_Handler_Type,
      command: string[],
      args: string[],
      promptRef?: string,
      promptVariables?: Record<string, string>,
    },
    runtime: {
      dockerArgs?: string[],
      image: string,
      setupScript: string,
      env: Record<string, string>,
      timeoutSec: number,
    },
  };
  type Github_Flows_Execution_Profile__Selected = {
    id: string,
    execution: Github_Flows_Execution_Profile__Execution,
    orderKey: string,
    promptRefBaseDir: string | undefined,
    trigger: Record<string, unknown>,
  };
  type Github_Flows_Execution_Profile_Resolver = import("./src/Execution/Profile/Resolver.mjs").default;
  type Github_Flows_Execution_Launch_Contract__Handler = {
    type: Github_Flows_Execution_Handler_Type,
    command: string[],
    args: string[],
    prompt: string,
  };
  type Github_Flows_Execution_Launch_Contract__Environment = {
    dockerArgs: string[],
    image: string,
    workspaceRoot: string,
    workspacePath: string,
    setupScript: string,
    env: Record<string, string>,
    timeoutSec: number,
  };
  type Github_Flows_Execution_Start_Coordinator = import("./src/Execution/Start/Coordinator.mjs").default;
  type Github_Flows_Execution_Launch_Contract = {
    handler: Github_Flows_Execution_Launch_Contract__Handler,
    environment: Github_Flows_Execution_Launch_Contract__Environment,
  };
  type Github_Flows_Execution_Workspace = {
    eventId: string,
    eventType: string,
    githubRepoId: number | string | undefined,
    owner: string,
    repo: string,
    repoPath: string,
    repositoryCachePath: string,
    workspaceRoot: string,
    workspacePath: string,
  };
  type Github_Flows_Execution_Runtime_Result = {
    attempted: true,
    completed: boolean,
    exit: "success" | "failure" | "timeout",
    stderr: string,
    stdout: string,
  };
  type Github_Flows_Execution_Launch_Contract_Factory = import("./src/Execution/Launch/Contract/Factory.mjs").default;
  type Github_Flows_Execution_Preparation_Prompt_Materializer__Bindings = Record<string, string | number | boolean>;
  type Github_Flows_Execution_Preparation_Prompt_Materializer__Result = {
    prompt: string,
    promptBindings: Github_Flows_Execution_Preparation_Prompt_Materializer__Bindings,
  };
  type Github_Flows_Execution_Preparation_Prompt_Materializer = import("./src/Execution/Preparation/Prompt/Materializer.mjs").default;
  type Github_Flows_Execution_Runtime_Docker = import("./src/Execution/Runtime/Docker.mjs").default;
  type Github_Flows_Execution_Workspace_Preparer = import("./src/Execution/Workspace/Preparer.mjs").default;
  type Github_Flows_Logger = import("./src/Logger.mjs").default;
  type Github_Flows_Repo_Cache_Manager = import("./src/Repo/Cache/Manager.mjs").default;
  type Github_Flows_Web_Handler_Webhook = import("./src/Web/Handler/Webhook.mjs").default;
  type Github_Flows_Web_Handler_Webhook_EventLog = import("./src/Web/Handler/Webhook/EventLog.mjs").default;
  type Github_Flows_Web_Handler_Webhook_Signature = import("./src/Web/Handler/Webhook/Signature.mjs").default;
  type Github_Flows_Web_Server = import("./src/Web/Server.mjs").default;
  type Github_Flows_Web_Handler_Webhook__Info = import("@flancer32/teq-web/src/Back/Dto/Info.mjs").default;
}

export {};
