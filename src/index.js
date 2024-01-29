const { createExtension, createNodeDescriptor } = require('@cognigy/extension-tools');
const { execSync, exec } = require('child_process');
const { writeFileSync } = require('fs');

const tmpPath = `${__dirname}/../tmp/main.go`;
const goRoot = `${__dirname}/../go`;
const goPath = `${__dirname}/../go/bin/go`;

// We give Go binary the jackpot, so it can be executed by anyone.
try {
  execSync(`chmod 777 ${goPath}`);
} catch(e) {}

exports.default = createExtension({
  nodes: [

    createNodeDescriptor({

      type: "Execute Go",
      summary: 'Execute Go code. Output can be sent to user or stored in context/input as string or buffer.',
      fields: [
        {
          key: 'code',
          label: 'Code',
          description: 'The Go code. // @ts-nocheck will be stripped off before execution',
          type: 'typescript',
          defaultValue: '// @ts-nocheck\n\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("hello there")\n}',
          params: {
            required: true
          }
        },

        {
          key: 'outputLocation',
          label: 'Output location',
          description: 'If location is "say", then output is converted to string before being sent to endpoint.',
          type: 'select',
          defaultValue: 'say',
          params: {
            required: true,
            options: ['context', 'input', 'say'].map(t => ({
              label: t,
              value: t
            }))
          }
        },

        {
          key: 'stringify',
          label: 'Cast to String',
          description: 'Cast result to String or keep it as Buffer',
          type: 'toggle',
          defaultValue: true,
          params: {
            required: true,
          },
          condition: {
            or: [
              {
                key: 'outputLocation',
                value: 'context',
              },
              {
                key: 'outputLocation',
                value: 'input'
              }
            ]
          }
        },

        {
          key: 'locationPath',
          label: 'Location path',
          description: 'Location in context',
          type: 'cognigyText',
          defaultValue: 'Go.result',
          params: {
            required: true
          },
          condition: {
            or: [
              {
                key: 'outputLocation',
                value: 'context',
              },
              {
                key: 'outputLocation',
                value: 'input'
              }
            ]
          }
        }
      ],

      function: async ({ config, cognigy }) => {
        const { code, outputLocation, locationPath, stringify } = config;
        const { api } = cognigy;

        api.log('debug', `writhing tmp file ${tmpPath}...`)
        writeFileSync(
          tmpPath, 
          code.replaceAll('// @ts-nocheck', ''),
        );


        api.log('debug', `executing ${goPath}...`)

        /**
         * @type {Buffer}
         */
        const result = execSync(`export GOROOT="${goRoot}" && export GOCACHE=${goRoot}/cache && ${goPath} run ${tmpPath}`);

        switch(outputLocation) {
          case "say": {
            return api.say(result.toString('utf8'));
          }

          case "input": {
            return api.addToInput(locationPath, stringify ? result.toString('utf8') : result);
          }

          case "context": {
            return api.addToContext(locationPath, stringify ? result.toString('utf8') : result, 'simple');
          }
        }

      }
    })

  ]
});
