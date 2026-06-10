# Event Attribute Provider Example

- Path: `ai/examples/event-attribute-provider.md`
- Version: `20260610`

This example shows how a host application can register one optional `Github_Flows_Event_Attribute_Provider` during startup.

```js
// App/Github/Attribute/Provider.mjs
// @ts-check

export default class App_Github_Attribute_Provider {
    constructor() {
        /**
         * @param {{
         *   eventModel: Github_Flows_Event_Model__Data,
         *   headers?: Record<string, string | string[] | undefined>,
         *   loggingContext?: Github_Flows_Event_Logging_Context__Data,
         *   payload: unknown,
         * }} params
         * @returns {Promise<Partial<Github_Flows_Event_Attribute__Set> | undefined>}
         */
        this.getAttributes = async function ({eventModel, payload}) {
            const body = /** @type {Record<string, unknown>} */ (payload ?? {});
            const issue = /** @type {Record<string, unknown>} */ (body.issue ?? {});
            const user = /** @type {Record<string, unknown>} */ (issue.user ?? {});

            return {
                issueAuthor: typeof user.login === 'string' ? user.login : undefined,
                reviewLane: eventModel.repository.fullName === 'acme/demo' ? 'priority' : 'default',
            };
        };
    }
}
```

```js
// App/Github/Bootstrap.mjs
// @ts-check

export const __deps__ = {
    attributeProviderHolder: 'Github_Flows_Event_Attribute_Provider_Holder$',
    runtimeFactory: 'Github_Flows_Config_Runtime__Factory$',
    webServer: 'Github_Flows_Web_Server$',
    provider: 'App_Github_Attribute_Provider$',
};

export default class App_Github_Bootstrap {
    /**
     * @param {{
     *   attributeProviderHolder: Github_Flows_Event_Attribute_Provider_Holder,
     *   runtimeFactory: Github_Flows_Config_Runtime__Factory,
     *   webServer: Github_Flows_Web_Server,
     *   provider: App_Github_Attribute_Provider,
     * }} deps
     */
    constructor({attributeProviderHolder, runtimeFactory, webServer, provider}) {
        this.execute = async function () {
            runtimeFactory.configure({
                workspaceRoot: './var/github-flows',
                webhookSecret: 'shared-secret',
            });
            runtimeFactory.freeze();

            attributeProviderHolder.set(provider);

            await webServer.start();
        };
    }
}
```

```js
const app = await container.get('App_Github_Bootstrap$');
await app.execute();
```

Example profile fragment using the same-event provider output for prompt materialization:

```json
{
  "trigger": {
    "repository": "acme/demo",
    "event": "issues",
    "action": "opened",
    "reviewLane": ["priority", "expedite"]
  },
  "execution": {
    "handler": {
      "type": "agent",
      "promptRef": "prompt.md",
      "promptVariables": {
        "required": {
          "ISSUE_AUTHOR": "host.issueAuthor",
          "ISSUE_TITLE": "event.issue.title"
        },
        "optional": {
          "REVIEW_LANE": {
            "path": "host.reviewLane",
            "default": ""
          }
        }
      }
    }
  }
}
```

Notes:

- register the provider once during startup;
- prefer `eventModel` for package-owned base attributes;
- use raw `payload` for business-specific event facts that the package does not normalize;
- return host-provided additional event attributes only;
- do not return package-owned base attributes such as `event`, `repository`, `action`, or `actorLogin`;
- trigger arrays remain configuration-time sugar, are expanded into scalar candidates after profile merge and before matching, and do not introduce runtime membership checks;
- empty trigger arrays contribute no candidate profiles;
- use `host.*` prompt bindings only for values returned by the same-event provider;
- prefer structured `promptVariables.required` / `promptVariables.optional` in new profiles;
- let the package handle profile matching and execution permission;
- skip the provider entirely if the host does not need extra event attributes.
