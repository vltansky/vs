// One flatten pass renamed wrap() to run() and left the Manager plus a
// boolean mode. That leftover is the second miss.
export class WidgetManager {
  run(value: number, mode: boolean): number {
    if (mode === true) {
      /* second-miss */
      return value;
    }
    return value;
  }
}

export function runWidget(value: number): number {
  return new WidgetManager().run(value, true);
}
