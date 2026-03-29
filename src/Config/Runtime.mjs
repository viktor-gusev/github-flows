/**
 * Runtime configuration data for github-flows.
 */
export class Data {
  /** @type {string} */
  httpHost = "127.0.0.1";

  /** @type {number} */
  httpPort = 3000;

  /** @type {string|undefined} */
  workspaceRoot;

  /** @type {string|undefined} */
  runtimeImage;

  /** @type {string|undefined} */
  webhookSecret;
}

/** @type {Data} */
const cfg = new Data();

/**
 * Runtime configuration factory.
 */
export class Factory {
  constructor() {
    let frozen = false;

    this.configure = function (params = {}) {
      if (frozen) {
        throw new Error("Runtime configuration is already frozen.");
      }

      if (params.httpHost !== undefined && cfg.httpHost === "127.0.0.1") {
        cfg.httpHost = params.httpHost;
      }
      if (params.httpPort !== undefined && cfg.httpPort === 3000) {
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
        return;
      }

      if (cfg.workspaceRoot === undefined) {
        throw new Error("Missing required runtime configuration field: workspaceRoot");
      }
      if (cfg.runtimeImage === undefined) {
        throw new Error("Missing required runtime configuration field: runtimeImage");
      }
      if (cfg.webhookSecret === undefined) {
        throw new Error("Missing required runtime configuration field: webhookSecret");
      }

      frozen = true;
      Object.freeze(cfg);
      initialized = true;
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

Object.freeze(Data.prototype);
Object.freeze(Factory.prototype);
