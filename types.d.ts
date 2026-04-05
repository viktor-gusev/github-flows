declare global {
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
  type Github_Flows_Execution_Profile__Launch = {
    handler: {
      type: string,
      command: string[],
      args: string[],
    },
    prompt: string,
    runtime: {
      image: string,
      setupScript: string,
      env: Record<string, string>,
      timeoutSec: number,
    },
  };
  type Github_Flows_Execution_Profile__Selected = {
    id: string,
    launch: Github_Flows_Execution_Profile__Launch,
    orderKey: string,
    trigger: Record<string, unknown>,
    type: string | undefined,
  };
  type Github_Flows_Execution_Profile_Resolver = import("./src/Execution/Profile/Resolver.mjs").default;
  type Github_Flows_Execution_Launch_Contract__Handler = {
    type: string,
    command: string[],
    args: string[],
    prompt: string,
  };
  type Github_Flows_Execution_Launch_Contract__Environment = {
    image: string,
    workspaceRoot: string,
    workspacePath: string,
    setupScript: string,
    env: Record<string, string>,
    timeoutSec: number,
  };
  type Github_Flows_Execution_Start_Coordinator = import("./src/Execution/Start/Coordinator.mjs").default;
  type Github_Flows_Execution_Launch_Contract = {
    type: string,
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
