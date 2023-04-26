import { ActionKit, errorify, HostPaths, RunTestInputs, transformAndValidate } from '@dogu-tech/action-kit';
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

ActionKit.run(async ({ options, logger, config, deviceHostClient, consoleActionClient }) => {
  const { DOGU_ACTION_INPUTS, DOGU_DEVICE_WORKSPACE_ON_HOST_PATH, DOGU_PROJECT_ID, DOGU_LOG_LEVEL } = options;
  logger.info('log level', { DOGU_LOG_LEVEL });
  const validatedInputs = await transformAndValidate(RunTestInputs, JSON.parse(DOGU_ACTION_INPUTS));
  const { script } = validatedInputs;
  const paths = await deviceHostClient.getPaths();
  const nodeBinPath = path.dirname(paths.common.node16);
  const yarnPath = HostPaths.yarnPath(paths.common.node16);
  let deviceProjectGitPath = path.resolve(HostPaths.deviceProjectGitPath(DOGU_DEVICE_WORKSPACE_ON_HOST_PATH, DOGU_PROJECT_ID));

  async function loadUserLocalProjectPath(): Promise<string> {
    try {
      const devConfig = await fs.promises.readFile('dev.config.json', {
        encoding: 'utf8',
      });
      const parsed = JSON.parse(devConfig);
      if (parsed.localUserProject.use) {
        return parsed.localUserProject.path;
      }
    } catch (error) {
      logger.debug('dev.config.json failed', { error: errorify(error) });
    }
    return '';
  }

  const localUserProjectPath = await loadUserLocalProjectPath();
  if (localUserProjectPath) {
    logger.info('Running locally');
    deviceProjectGitPath = localUserProjectPath;
  } else {
    logger.info('Running on device host project');
  }

  function yarn(args: string[]) {
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
    const result = spawnSync(command, args, {
      stdio: 'inherit',
      env,
      cwd,
    });
    if (result.status !== 0) {
      throw new Error(`Command failed: ${command} ${args.join(' ')}`);
    }
  }

  const yarnLockPath = path.resolve(deviceProjectGitPath, 'yarn.lock');
  const stat = await fs.promises.stat(yarnLockPath).catch(() => null);
  if (!stat) {
    logger.info('yarn.lock not found, create yarn.lock');
    const handle = await fs.promises.open(yarnLockPath, 'w');
    await handle.close();
    logger.info('yarn.lock created');
  }
  yarn(['install']);
  yarn(['run', 'newbie:cicd']);
  yarn(['up']);
  yarn(['run', 'build:cicd']);
  yarn(['ts-node', script]);
});
