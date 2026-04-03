declare global {
  type Github_Flows_Config_Runtime = import("./src/Config/Runtime.mjs").Data;
  type Github_Flows_Config_Runtime__Wrapper = import("./src/Config/Runtime.mjs").default;
  type Github_Flows_Config_Runtime__Factory = import("./src/Config/Runtime.mjs").Factory;
  type Github_Flows_Web_Handler_Webhook = import("./src/Web/Handler/Webhook.mjs").default;
  type Github_Flows_Web_Handler_Webhook_EventLog = import("./src/Web/Handler/Webhook/EventLog.mjs").default;
  type Github_Flows_Web_Handler_Webhook_Signature = import("./src/Web/Handler/Webhook/Signature.mjs").default;
  type Github_Flows_Web_Server = import("./src/Web/Server.mjs").default;
  type Github_Flows_Web_Handler_Webhook__Info = import("@flancer32/teq-web/src/Back/Dto/Info.mjs").default;
  type Node_Http = typeof import("node:http");
  type Node_Http__Server = import("node:http").Server;
}

export {};
