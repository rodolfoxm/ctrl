// Names of the Windows objects the app creates. Versions before the rename used
// "mojoTWEEKS"; checks and reverts still recognise those so old changes stay undoable.
module.exports = {
  PLAN_NAME: 'ctrl Desempenho',
  PLAN_MATCH: '(ctrl|mojoTWEEKS) Desempenho',
  FW_RULE: 'ctrl - bloquear telemetria (DiagTrack)',
  FW_RULES_ALL: "'ctrl - bloquear telemetria (DiagTrack)','mojoTWEEKS - bloquear telemetria (DiagTrack)'",
};
