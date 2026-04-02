declare global {
  type Github_Flows_Config_Runtime = import("./src/Config/Runtime.mjs").Data;
  type Github_Flows_Config_Runtime__Wrapper = import("./src/Config/Runtime.mjs").default;
  type Github_Flows_Config_Runtime__Factory = import("./src/Config/Runtime.mjs").Factory;
  type Github_Flows_Web_Server = import("./src/Web/Server.mjs").default;
  type Node_Http = typeof import("node:http");
  type Node_Http__Server = import("node:http").Server;
}

export {};
