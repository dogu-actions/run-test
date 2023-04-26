"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const action_kit_1 = require("@dogu-tech/action-kit");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
action_kit_1.ActionKit.run(async ({ options, logger, config, deviceHostClient, consoleActionClient }) => {
    const { DOGU_ACTION_INPUTS, DOGU_DEVICE_WORKSPACE_ON_HOST_PATH, DOGU_PROJECT_ID, DOGU_LOG_LEVEL } = options;
    logger.info('log level', { DOGU_LOG_LEVEL });
    const validatedInputs = await (0, action_kit_1.transformAndValidate)(action_kit_1.RunTestInputs, DOGU_ACTION_INPUTS);
    const { script } = validatedInputs;
    const paths = await deviceHostClient.getPaths();
    const nodeBinPath = path_1.default.dirname(paths.common.node16);
    const yarnPath = action_kit_1.HostPaths.yarnPath(paths.common.node16);
    let deviceProjectGitPath = path_1.default.resolve(action_kit_1.HostPaths.deviceProjectGitPath(DOGU_DEVICE_WORKSPACE_ON_HOST_PATH, DOGU_PROJECT_ID));
    async function loadUserLocalProjectPath() {
        try {
            const devConfig = await fs_1.default.promises.readFile('dev.config.json', {
                encoding: 'utf8',
            });
            const parsed = JSON.parse(devConfig);
            if (parsed.localUserProject.use) {
                return parsed.localUserProject.path;
            }
        }
        catch (error) {
            logger.debug('dev.config.json failed', { error: (0, action_kit_1.errorify)(error) });
        }
        return '';
    }
    const localUserProjectPath = await loadUserLocalProjectPath();
    if (localUserProjectPath) {
        logger.info('Running locally');
        deviceProjectGitPath = localUserProjectPath;
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
    const yarnLockPath = path_1.default.resolve(deviceProjectGitPath, 'yarn.lock');
    const stat = await fs_1.default.promises.stat(yarnLockPath).catch(() => null);
    if (!stat) {
        logger.info('yarn.lock not found, create yarn.lock');
        fs_1.default.promises.writeFile(yarnLockPath, '');
        logger.info('yarn.lock created');
    }
    command(['run', 'newbie:cicd']);
    command(['up']);
    command(['run', 'build:cicd']);
    command(['ts-node', script]);
});
//# sourceMappingURL=main.js.map