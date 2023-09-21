"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const action_kit_1 = require("@dogu-tech/action-kit");
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const lodash_1 = __importDefault(require("lodash"));
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const pythonCheckTimeout = 10000;
const TestEnvironment = ['node', 'python'];
const isValidTestEnvironment = (value) => TestEnvironment.includes(value);
action_kit_1.ActionKit.run(async ({ options, logger, input, deviceHostClient, consoleActionClient, deviceClient }) => {
    const { DOGU_LOG_LEVEL, //
    DOGU_ROUTINE_WORKSPACE_PATH, DOGU_DEVICE_PLATFORM, DOGU_HOST_WORKSPACE_PATH, DOGU_DEVICE_SERIAL, DOGU_STEP_WORKING_PATH, } = options;
    logger.info('log level', { DOGU_LOG_LEVEL });
    const checkout = input.get('checkout');
    const branch = input.get('branch');
    const tag = input.get('tag');
    const clean = input.get('clean');
    const checkoutPath = input.get('checkoutPath');
    const checkoutUrl = input.get('checkoutUrl');
    const appVersion = input.get('appVersion');
    const appPackageName = input.get('appPackageName');
    const uninstallApp = input.get('uninstallApp');
    const installApp = input.get('installApp');
    const runApp = input.get('runApp');
    const environment = input.get('environment');
    const command = input.get('command');
    if (!isValidTestEnvironment(environment)) {
        throw new Error(`Invalid environment: ${environment}`);
    }
    if (checkout) {
        logger.info('resolve checkout path... from', { DOGU_ROUTINE_WORKSPACE_PATH, checkoutPath });
        const resolvedCheckoutPath = path_1.default.resolve(DOGU_ROUTINE_WORKSPACE_PATH, checkoutPath);
        logger.info('resolved checkout path', { resolvedCheckoutPath });
        await (0, action_kit_1.checkoutProject)(logger, consoleActionClient, deviceHostClient, resolvedCheckoutPath, clean, branch, tag, checkoutUrl);
    }
    let appPath = '';
    const resolvedAppVersion = appVersion || process.env.DOGU_APP_VERSION || '';
    const resolvedAppPackageName = appPackageName || process.env.DOGU_APP_PACKAGE_NAME || '';
    if (resolvedAppPackageName) {
        const currentPlatformPackageName = typeof resolvedAppPackageName === 'object'
            ? (() => {
                const platformAppVersion = Reflect.get(resolvedAppPackageName, DOGU_DEVICE_PLATFORM);
                if (!platformAppVersion) {
                    throw new Error(`Invalid app package name: ${(0, action_kit_1.stringify)(resolvedAppPackageName)} for platform: ${DOGU_DEVICE_PLATFORM}`);
                }
                return platformAppVersion;
            })()
            : String(resolvedAppPackageName);
        appPath = await (0, action_kit_1.downloadApp)(logger, consoleActionClient, deviceHostClient, DOGU_DEVICE_PLATFORM, DOGU_HOST_WORKSPACE_PATH, { appPackageName: currentPlatformPackageName });
    }
    else if (resolvedAppVersion) {
        const currentPlatformAppVersion = typeof resolvedAppVersion === 'object'
            ? (() => {
                const platformAppVersion = Reflect.get(resolvedAppVersion, DOGU_DEVICE_PLATFORM);
                if (!platformAppVersion) {
                    throw new Error(`Invalid app version: ${(0, action_kit_1.stringify)(resolvedAppVersion)} for platform: ${DOGU_DEVICE_PLATFORM}`);
                }
                return platformAppVersion;
            })()
            : String(resolvedAppVersion);
        appPath = await (0, action_kit_1.downloadApp)(logger, consoleActionClient, deviceHostClient, DOGU_DEVICE_PLATFORM, DOGU_HOST_WORKSPACE_PATH, { appVersion: currentPlatformAppVersion });
    }
    let env = (0, action_kit_1.newCleanNodeEnv)();
    if (appPath) {
        const appEnv = {
            DOGU_APP_PATH: appPath,
        };
        logger.info('update env for app and driver', {
            ...appEnv,
        });
        env = lodash_1.default.merge(env, appEnv);
        if (uninstallApp) {
            logger.info('Uninstalling app...', { appPath });
            try {
                await deviceClient.uninstallApp(DOGU_DEVICE_SERIAL, appPath);
                logger.info('App uninstalled');
            }
            catch (error) {
                logger.warn('Failed to uninstall app', { error: (0, action_kit_1.errorify)(error) });
            }
        }
        if (installApp) {
            logger.info('Installing app...', { appPath });
            await deviceClient.installApp(DOGU_DEVICE_SERIAL, appPath);
            logger.info('App installed');
        }
        if (runApp) {
            logger.info('Run app...', { appPath });
            await deviceClient.runApp(DOGU_DEVICE_SERIAL, appPath);
            logger.info('App runned');
        }
    }
    await fs_1.default.promises.mkdir(DOGU_STEP_WORKING_PATH, { recursive: true });
    const prefixCommands = [];
    switch (environment) {
        case 'node':
            {
                // noop
            }
            break;
        case 'python':
            {
                const pythonExe = process.platform === 'win32' ? 'python' : 'python3';
                try {
                    await execAsync(`${pythonExe} --version`, { timeout: pythonCheckTimeout });
                }
                catch (error) {
                    throw new Error(`Please ensure command [${pythonExe}] 🐍 first. if you are using macos, please read this https://docs.dogutech.io/device-farm/host/macos/advanced-configuration`);
                }
                prefixCommands.push(`${pythonExe} -m venv .venv`);
                if (process.platform === 'win32') {
                    prefixCommands.push('.venv\\Scripts\\activate.bat');
                }
                else {
                    prefixCommands.push('source .venv/bin/activate');
                }
            }
            break;
        default:
            (0, action_kit_1.assertUnreachable)(environment);
            throw new Error(`Unexpected environment: ${environment}`);
    }
    const onelineCommands = command
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line);
    const executeCommands = [...prefixCommands, ...onelineCommands];
    const executeCommand = executeCommands.join(' && ');
    logger.info(`Run command: [${executeCommand}] on ${DOGU_STEP_WORKING_PATH}`);
    const result = (0, child_process_1.spawnSync)(executeCommand, {
        encoding: 'utf8',
        stdio: 'inherit',
        shell: process.env.SHELL ?? true,
        cwd: DOGU_STEP_WORKING_PATH,
        env,
    });
    if (result.status === 0) {
        logger.info(`Command succeed: [${executeCommand}] with status: ${result.status}`);
    }
    else {
        throw new Error(`Command failed: [${executeCommand}] with status: ${result.status}`);
    }
});
//# sourceMappingURL=main.js.map