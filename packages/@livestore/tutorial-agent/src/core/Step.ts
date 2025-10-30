export type StepResult = {
  ok: true;
} | {
  ok: false;
  error: Error;
};

export interface StepContext {
  workspaceDir: string;
  appDir: string;
  artifactsDir: string;
  env: NodeJS.ProcessEnv;
}

export interface Step {
  name: string;
  run(ctx: StepContext): Promise<StepResult>;
}

