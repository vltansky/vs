// One flatten pass inlined wrap() into runWidget. The leftover boolean
// mode still splits one path — that is the second miss.
export function runWidget(value: number, mode: boolean): number {
  if (mode === true) {
    return value;
  }
  return value;
}
