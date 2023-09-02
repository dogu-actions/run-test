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
action_kit_1.ActionKit.run(async ({ options, logger, input, deviceHostClient, consoleActionClient, deviceClient }) => {
    const { DOGU_LOG_LEVEL, //
    DOGU_ROUTINE_WORKSPACE_PATH, DOGU_DEVICE_PLATFORM, DOGU_HOST_WORKSPACE_PATH, DOGU_DEVICE_SERIAL, DOGU_STEP_WORKING_PATH, DOGU_BROWSER_NAME, DOGU_BROWSER_VERSION, } = options;
    logger.info('log level', { DOGU_LOG_LEVEL });
    const checkout = input.get('checkout');
    const branchOrTag = input.get('branchOrTag');
    const clean = input.get('clean');
    const checkoutPath = input.get('checkoutPath');
    const checkoutUrl = input.get('checkoutUrl');
    const appVersion = input.get('appVersion');
    const uninstallApp = input.get('uninstallApp');
    const installApp = input.get('installApp');
    const runApp = input.get('runApp');
    const command = input.get('command');
    if (checkout) {
        logger.info('resolve checkout path... from', { DOGU_ROUTINE_WORKSPACE_PATH, checkoutPath });
        const resolvedCheckoutPath = path_1.default.resolve(DOGU_ROUTINE_WORKSPACE_PATH, checkoutPath);
        logger.info('resolved checkout path', { resolvedCheckoutPath });
        await (0, action_kit_1.checkoutProject)(logger, consoleActionClient, deviceHostClient, resolvedCheckoutPath, branchOrTag, clean, checkoutUrl);
    }
    let appPath = '';
    if (appVersion) {
        const currentPlatformAppVersion = typeof appVersion === 'object'
            ? (() => {
                const platformAppVersion = Reflect.get(appVersion, DOGU_DEVICE_PLATFORM);
                if (!platformAppVersion) {
                    throw new Error(`Invalid app version: ${(0, action_kit_1.stringify)(appVersion)} for platform: ${DOGU_DEVICE_PLATFORM}`);
                }
                return platformAppVersion;
            })()
            : String(appVersion);
        appPath = await (0, action_kit_1.downloadApp)(logger, consoleActionClient, deviceHostClient, DOGU_DEVICE_PLATFORM, DOGU_HOST_WORKSPACE_PATH, currentPlatformAppVersion);
    }
    let env = process.env;
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
    if (DOGU_BROWSER_NAME) {
        logger.info('Ensure browser and driver...', { DOGU_BROWSER_NAME, DOGU_BROWSER_VERSION });
        const { browserName: ensuredBrowserName, browserVersion: ensuredBrowserVersion, browserPath, browserPackageName, browserDriverPath, browserMajorVersion, } = await deviceHostClient.ensureBrowserAndDriver({
            browserName: DOGU_BROWSER_NAME,
            browserPlatform: DOGU_DEVICE_PLATFORM,
            browserVersion: DOGU_BROWSER_VERSION,
            deviceSerial: DOGU_DEVICE_SERIAL,
        });
        const browserEnv = {
            DOGU_BROWSER_NAME: ensuredBrowserName,
            DOGU_BROWSER_VERSION: ensuredBrowserVersion || '',
            DOGU_BROWSER_MAJOR_VERSION: browserMajorVersion ? String(browserMajorVersion) : '',
            DOGU_BROWSER_PATH: browserPath || '',
            DOGU_BROWSER_DRIVER_PATH: browserDriverPath,
            DOGU_BROWSER_PACKAGE_NAME: browserPackageName || '',
        };
        logger.info('update env for browser and driver', {
            ...browserEnv,
        });
        env = lodash_1.default.merge(env, browserEnv);
    }
    await fs_1.default.promises.mkdir(DOGU_STEP_WORKING_PATH, { recursive: true });
    const onelineCommand = command
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line)
        .join(' && ');
    logger.info(`Run command: [${onelineCommand}] on ${DOGU_STEP_WORKING_PATH}`);
    const result = (0, child_process_1.spawnSync)(onelineCommand, {
        stdio: 'inherit',
        shell: true,
        cwd: DOGU_STEP_WORKING_PATH,
        env,
    });
    if (result.status === 0) {
        logger.info(`Command succeed: [${onelineCommand}] with status: ${result.status}`);
    }
    else {
        throw new Error(`Command failed: [${onelineCommand}] with status: ${result.status}`);
    }
});
//# sourceMappingURL=main.js.map