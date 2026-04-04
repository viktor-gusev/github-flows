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
  type Github_Flows_Config_Runtime = import("./src/Config/Runtime.mjs").Data;
  type Github_Flows_Config_Runtime__Wrapper = import("./src/Config/Runtime.mjs").default;
  type Github_Flows_Config_Runtime__Factory = import("./src/Config/Runtime.mjs").Factory;
  type Github_Flows_Execution_Workspace_Preparer = import("./src/Execution/Workspace/Preparer.mjs").default;
  type Github_Flows_Repo_Cache_Manager = import("./src/Repo/Cache/Manager.mjs").default;
  type Node_ChildProcess = typeof import("node:child_process");
  type Node_Fs_Promises = typeof import("node:fs/promises");
  type Github_Flows_Web_Handler_Webhook = import("./src/Web/Handler/Webhook.mjs").default;
  type Github_Flows_Web_Handler_Webhook_EventLog = import("./src/Web/Handler/Webhook/EventLog.mjs").default;
  type Github_Flows_Web_Handler_Webhook_Signature = import("./src/Web/Handler/Webhook/Signature.mjs").default;
  type Github_Flows_Web_Server = import("./src/Web/Server.mjs").default;
  type Github_Flows_Web_Handler_Webhook__Info = import("@flancer32/teq-web/src/Back/Dto/Info.mjs").default;
  type Node_Http = typeof import("node:http");
  type Node_Http__Server = import("node:http").Server;
  type Node_Path = typeof import("node:path");
}

export {};
