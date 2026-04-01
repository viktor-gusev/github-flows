/**
 * Runtime configuration data for github-flows.
 */
export class Data {
  /** @type {string} */
  runtimeImage;

  /** @type {string} */
  httpHost;

  /** @type {number} */
  httpPort;

  /** @type {Fl32_Web_Back_Config_Runtime} */
  webConfig;

  /** @type {string} */
  webhookSecret;

  /** @type {string} */
  workspaceRoot;
}

/** @type {Data} */
const cfg = new Data();

/**
 * Runtime configuration factory.
 */
export class Factory {
  /**
   * @param {object} deps
   * @param {Fl32_Web_Back_Config_Runtime$Factory} deps.webConfigFactory
   */
  constructor({ webConfigFactory }) {
    let frozen = false;

    this.configure = function (params = {}) {
      if (frozen) {
        throw new Error("Runtime configuration is already frozen.");
      }

      if (params.httpHost !== undefined && cfg.httpHost === undefined) {
        cfg.httpHost = params.httpHost;
      }
      if (params.httpPort !== undefined && cfg.httpPort === undefined) {
        cfg.httpPort = params.httpPort;
      }
      if (params.workspaceRoot !== undefined && cfg.workspaceRoot === undefined) {
        cfg.workspaceRoot = params.workspaceRoot;
      }
      if (params.runtimeImage !== undefined && cfg.runtimeImage === undefined) {
        cfg.runtimeImage = params.runtimeImage;
      }
      if (params.webhookSecret !== undefined && cfg.webhookSecret === undefined) {
        cfg.webhookSecret = params.webhookSecret;
      }
    };

    this.freeze = function () {
      if (frozen) {
        return proxy;
      }

      if (cfg.httpHost === undefined) cfg.httpHost = "127.0.0.1";
      if (cfg.httpPort === undefined) cfg.httpPort = 3000;

      if (cfg.workspaceRoot === undefined) {
        throw new Error("Missing required runtime configuration field: workspaceRoot");
      }
      if (cfg.runtimeImage === undefined) {
        throw new Error("Missing required runtime configuration field: runtimeImage");
      }
      if (cfg.webhookSecret === undefined) {
        throw new Error("Missing required runtime configuration field: webhookSecret");
      }

      // @ts-ignore
      webConfigFactory.configure({
        port: cfg.httpPort,
        type: "http",
      });
      const webConfig = webConfigFactory.freeze();
      if (cfg.webConfig === undefined) cfg.webConfig = webConfig;

      frozen = true;
      Object.freeze(cfg);
      initialized = true;
      return proxy;
    };
  }
}

/**
 * Runtime configuration wrapper.
 */
const facade = {};
let initialized = false;

const proxy = new Proxy(facade, {
  get(_target, prop) {
    const isServiceProp = prop === "then" || typeof prop === "symbol";
    if (!initialized && !isServiceProp) {
      throw new Error("Runtime configuration is not initialized.");
    }
    return Reflect.get(cfg, prop);
  },
  set() {
    throw new Error("Runtime configuration is immutable.");
  },
  defineProperty() {
    throw new Error("Runtime configuration wrapper is immutable.");
  },
  deleteProperty() {
    throw new Error("Runtime configuration wrapper is immutable.");
  },
  preventExtensions() {
    throw new Error("Runtime configuration wrapper cannot be frozen.");
  },
});

export default class Wrapper {
  constructor() {
    return proxy;
  }
}

export const __deps__ = Object.freeze({
  Factory: Object.freeze({
    webConfigFactory: "Fl32_Web_Back_Config_Runtime__Factory$",
  }),
});

Object.freeze(Data.prototype);
Object.freeze(Factory.prototype);
