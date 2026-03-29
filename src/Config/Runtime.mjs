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

/**
 * Runtime configuration factory.
 */
export class Factory {
  /**
   * @param {object} deps
   * @param {Github_Flows_Config_Runtime$Data} deps.depData
   * @param {Github_Flows_Config_Runtime$Factory} deps.depFactory
   */
  constructor({ depData, depFactory }) {
    let frozen = false;

    this.configure = function (params = {}) {
      if (frozen) {
        throw new Error("Runtime configuration is already frozen.");
      }

      if (params.httpHost !== undefined && depData.httpHost === "127.0.0.1") {
        depData.httpHost = params.httpHost;
      }
      if (params.httpPort !== undefined && depData.httpPort === 3000) {
        depData.httpPort = params.httpPort;
      }
      if (params.workspaceRoot !== undefined && depData.workspaceRoot === undefined) {
        depData.workspaceRoot = params.workspaceRoot;
      }
      if (params.runtimeImage !== undefined && depData.runtimeImage === undefined) {
        depData.runtimeImage = params.runtimeImage;
      }
      if (params.webhookSecret !== undefined && depData.webhookSecret === undefined) {
        depData.webhookSecret = params.webhookSecret;
      }
    };

    this.freeze = function () {
      if (frozen) {
        return;
      }

      if (depData.workspaceRoot === undefined) {
        throw new Error("Missing required runtime configuration field: workspaceRoot");
      }
      if (depData.runtimeImage === undefined) {
        throw new Error("Missing required runtime configuration field: runtimeImage");
      }
      if (depData.webhookSecret === undefined) {
        throw new Error("Missing required runtime configuration field: webhookSecret");
      }

      frozen = true;
      Object.freeze(depData);
    };
  }
}

/**
 * Runtime configuration wrapper.
 */
export default class Wrapper {
  /**
   * @param {object} deps
   * @param {Github_Flows_Config_Runtime$Data} deps.depData
   */
  constructor({ depData }) {
    const state = depData;
    const facade = {};

    Object.defineProperties(facade, {
      httpHost: {
        enumerable: true,
        get() {
          return state.httpHost;
        },
      },
      httpPort: {
        enumerable: true,
        get() {
          return state.httpPort;
        },
      },
      workspaceRoot: {
        enumerable: true,
        get() {
          return state.workspaceRoot;
        },
      },
      runtimeImage: {
        enumerable: true,
        get() {
          return state.runtimeImage;
        },
      },
      webhookSecret: {
        enumerable: true,
        get() {
          return state.webhookSecret;
        },
      },
    });

    Object.setPrototypeOf(facade, null);

    return new Proxy(facade, {
      set() {
        throw new TypeError("Runtime configuration is read-only.");
      },
      defineProperty() {
        throw new TypeError("Runtime configuration is read-only.");
      },
      deleteProperty() {
        throw new TypeError("Runtime configuration is read-only.");
      },
      setPrototypeOf() {
        throw new TypeError("Runtime configuration is read-only.");
      },
      preventExtensions() {
        throw new TypeError("Runtime configuration is read-only.");
      },
    });
  }
}

export const __deps__ = Object.freeze({
  Factory: Object.freeze({
    depData: "Github_Flows_Config_Runtime$Data",
    depFactory: "Github_Flows_Config_Runtime$Factory",
  }),
});

Object.freeze(Data.prototype);
Object.freeze(Factory.prototype);
