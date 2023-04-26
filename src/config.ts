import path from 'path';

export const config = {
  localUserProject: {
    use: false, // process.env.DOGU_RUN_TYPE === 'local',
    path: path.resolve(process.cwd(), '../../user-templates/typescript-template'),
  },
};
