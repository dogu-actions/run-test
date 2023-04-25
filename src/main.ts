import { ActionKit, HostPaths, RunTestInputs, transformAndValidate } from '@dogu-tech/action-kit';
import { spawnSync } from 'child_process';
import path from 'path';

ActionKit.run(async ({ options, logger, config, deviceHostClient, consoleActionClient }) => {
  const { DOGU_ACTION_INPUTS, DOGU_DEVICE_WORKSPACE_ON_HOST_PATH, DOGU_PROJECT_ID, DOGU_LOG_LEVEL, DOGU_RUN_TYPE } = options;
  logger.info('log level', { DOGU_LOG_LEVEL });
  const validatedInputs = await transformAndValidate(RunTestInputs, DOGU_ACTION_INPUTS);
  const { script } = validatedInputs;
  const paths = await deviceHostClient.getPaths();
  const nodeBinPath = path.dirname(paths.common.node16);
  const yarnPath = path.resolve(nodeBinPath, '../lib/node_modules/yarn/bin/yarn');
  let deviceProjectGitPath = path.resolve(HostPaths.deviceProjectGitPath(DOGU_DEVICE_WORKSPACE_ON_HOST_PATH, DOGU_PROJECT_ID));
  if (DOGU_RUN_TYPE === 'local') {
    logger.info('Running locally');
    deviceProjectGitPath = path.resolve(process.cwd(), '../../user-templates/v1');
  } else {
    logger.info('Running on device host');
  }

  function command(args: string[]) {
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

  command(['run', 'newbie:cicd']);
  command(['up']);
  command(['run', 'build:cicd']);
  command(['ts-node', script]);
});
