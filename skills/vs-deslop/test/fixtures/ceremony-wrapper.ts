export class WidgetManager {
  wrap(value: number): number {
    return value;
  }
}

export function runWidget(value: number): number {
  return new WidgetManager().wrap(value);
}

// Invented extra file this pass must not add: WidgetFactory.ts / WidgetUtils.ts
