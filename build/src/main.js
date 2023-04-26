"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const action_kit_1 = require("@dogu-tech/action-kit");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
action_kit_1.ActionKit.run(async ({ options, logger, config, deviceHostClient, consoleActionClient }) => {
    const { DOGU_ACTION_INPUTS, DOGU_DEVICE_WORKSPACE_ON_HOST_PATH, DOGU_PROJECT_ID, DOGU_LOG_LEVEL, DOGU_RUN_TYPE } = options;
    logger.info('log level', { DOGU_LOG_LEVEL });
    const validatedInputs = await (0, action_kit_1.transformAndValidate)(action_kit_1.RunTestInputs, DOGU_ACTION_INPUTS);
    const { script } = validatedInputs;
    const paths = await deviceHostClient.getPaths();
    const nodeBinPath = path_1.default.dirname(paths.common.node16);
    const yarnPath = path_1.default.resolve(nodeBinPath, '../lib/node_modules/yarn/bin/yarn');
    let deviceProjectGitPath = path_1.default.resolve(action_kit_1.HostPaths.deviceProjectGitPath(DOGU_DEVICE_WORKSPACE_ON_HOST_PATH, DOGU_PROJECT_ID));
    if (config_1.config.localUserProject.use) {
        logger.info('Running locally');
        deviceProjectGitPath = config_1.config.localUserProject.path;
    }
    else {
        logger.info('Running on device host project');
    }
    function command(args) {
        const command = yarnPath;
        logger.info(`Running command: ${command} ${args.join(' ')}`);
        const env = {
            ...process.env,
            PATH: `${nodeBinPath}:${process.env.PATH}`,
        };
        logger.verbose('env', { env });
        const cwd = deviceProjectGitPath;
        logger.verbose('cwd', {
            cwd,
        });
        const result = (0, child_process_1.spawnSync)(command, args, {
            stdio: 'inherit',
            env,
            cwd,
        });
        if (result.status !== 0) {
            throw new Error(`Command failed: ${command} ${args.join(' ')}`);
        }
    }
    command(['run', 'newbie:cicd']);
    command(['up']);
    command(['run', 'build:cicd']);
    command(['ts-node', script]);
});
//# sourceMappingURL=main.js.map