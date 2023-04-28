"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const action_kit_1 = require("@dogu-tech/action-kit");
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
action_kit_1.ActionKit.run(async ({ options, logger, input, deviceHostClient }) => {
    const { DOGU_LOG_LEVEL, DOGU_DEVICE_PROJECT_WORKSPACE_PATH, DOGU_RUN_TYPE } = options;
    logger.info('log level', { DOGU_LOG_LEVEL });
    const script = input.get('script');
    const pathMap = await deviceHostClient.getPathMap();
    const { yarn } = pathMap.common;
    let yarnPath = yarn;
    let userProjectPath = path_1.default.resolve(action_kit_1.HostPaths.deviceProjectGitPath(DOGU_DEVICE_PROJECT_WORKSPACE_PATH));
    const optionsConfig = await action_kit_1.OptionsConfig.load();
    if (optionsConfig.get('localUserProject.use', false)) {
        logger.info('Using local user project...');
        async function findLocalUserProject() {
            const searchPaths = optionsConfig.get('localUserProject.searchPaths', []);
            for (const searchPath of searchPaths) {
                const candidate = path_1.default.resolve(searchPath);
                logger.info('Checking local user project path', { candidate });
                const doguConfigPath = path_1.default.resolve(candidate, 'dogu.config.json');
                const stat = await fs_1.default.promises.stat(doguConfigPath).catch(() => null);
                if (stat) {
                    return candidate;
                }
            }
            throw new Error(`Local user project not found in search paths: ${searchPaths.join(', ')}`);
        }
        yarnPath = 'yarn';
        userProjectPath = await findLocalUserProject();
    }
    else {
        logger.info('Using device user project...');
    }
    logger.info('User project path and yarn path', { userProjectPath, yarnPath });
    function runYarn(args) {
        const command = yarnPath;
        logger.info(`Running command: ${command} ${args.join(' ')}`);
        const result = (0, child_process_1.spawnSync)(command, args, {
            stdio: 'inherit',
            cwd: userProjectPath,
        });
        if (result.status !== 0) {
            throw new Error(`Command failed: ${command} ${args.join(' ')}`);
        }
    }
    if (!optionsConfig.get('localUserProject.use', false)) {
        runYarn(['install']);
        const packageJsonPath = path_1.default.resolve(userProjectPath, 'package.json');
        const content = await fs_1.default.promises.readFile(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(content);
        const doguDependencies = [];
        if (packageJson.dependencies) {
            for (const [key, value] of Object.entries(packageJson.dependencies)) {
                if (key.startsWith('@dogu-tech/')) {
                    doguDependencies.push(key);
                }
            }
        }
        for (const dependency of doguDependencies) {
            runYarn(['up', '-R', dependency]);
        }
        if (script.endsWith('.ts')) {
            runYarn(['tsc', '-b']);
        }
    }
    if (script.endsWith('.js')) {
        runYarn(['node', script]);
    }
    else if (script.endsWith('.ts')) {
        runYarn(['ts-node', script]);
    }
    else {
        throw new Error(`Unexpected script extension: ${script}`);
    }
});
//# sourceMappingURL=main.js.map
