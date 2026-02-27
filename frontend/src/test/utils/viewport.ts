type VisualViewportState = {
  width: number;
  height: number;
  offsetTop: number;
  offsetLeft: number;
  scale: number;
};

const originalVisualViewportDescriptor = Object.getOwnPropertyDescriptor(
  window,
  "visualViewport",
);

class VisualViewportMock {
  private readonly target = new EventTarget();
  private state: VisualViewportState;

  constructor(initialState: VisualViewportState) {
    this.state = initialState;
  }

  get width(): number {
    return this.state.width;
  }

  get height(): number {
    return this.state.height;
  }

  get offsetTop(): number {
    return this.state.offsetTop;
  }

  get offsetLeft(): number {
    return this.state.offsetLeft;
  }

  get pageTop(): number {
    return this.state.offsetTop;
  }

  get pageLeft(): number {
    return this.state.offsetLeft;
  }

  get scale(): number {
    return this.state.scale;
  }

  update(next: Partial<VisualViewportState>): void {
    const previous = this.state;
    this.state = { ...previous, ...next };

    const resized =
      next.width !== undefined ||
      next.height !== undefined ||
      next.scale !== undefined;
    const scrolled =
      next.offsetTop !== undefined || next.offsetLeft !== undefined;

    if (resized) {
      this.dispatchEvent(new Event("resize"));
      window.dispatchEvent(new Event("resize"));
    }
    if (scrolled) {
      this.dispatchEvent(new Event("scroll"));
    }
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (!listener) return;
    this.target.addEventListener(type, listener, options);
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    if (!listener) return;
    this.target.removeEventListener(type, listener, options);
  }

  dispatchEvent(event: Event): boolean {
    return this.target.dispatchEvent(event);
  }
}

let visualViewportMock: VisualViewportMock | null = null;

function buildDefaultVisualViewportState(): VisualViewportState {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    offsetTop: 0,
    offsetLeft: 0,
    scale: 1,
  };
}

function ensureVisualViewportMock(): VisualViewportMock {
  if (visualViewportMock) {
    return visualViewportMock;
  }

  visualViewportMock = new VisualViewportMock(buildDefaultVisualViewportState());
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    writable: true,
    value: visualViewportMock as unknown as VisualViewport,
  });

  return visualViewportMock;
}

export function setViewportSize(width: number, height: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });

  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: height,
  });

  if (visualViewportMock) {
    visualViewportMock.update({ width, height });
  } else {
    window.dispatchEvent(new Event("resize"));
  }
}

export function setVisualViewport(
  next: Partial<VisualViewportState>,
): VisualViewport {
  const mock = ensureVisualViewportMock();
  mock.update(next);
  return mock as unknown as VisualViewport;
}

export function resetVisualViewport(): void {
  visualViewportMock = null;

  if (originalVisualViewportDescriptor) {
    Object.defineProperty(
      window,
      "visualViewport",
      originalVisualViewportDescriptor,
    );
    return;
  }

  delete (window as Window & { visualViewport?: VisualViewport }).visualViewport;
}
