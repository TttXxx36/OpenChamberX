export function getCenteredScrollTop(input: {
    containerTop: number;
    containerHeight: number;
    containerScrollTop: number;
    messageTop: number;
    messageHeight: number;
}): number {
    const containerCenter = input.containerTop + input.containerHeight / 2;
    const messageCenter = input.messageTop + input.messageHeight / 2;
    return Math.max(0, input.containerScrollTop + messageCenter - containerCenter);
}

export function isWithinScrollTolerance(delta: number, tolerance: number): boolean {
    return Math.abs(delta) <= tolerance;
}

export function getNaturalBubbleTop(input: {
    anchorTop: number;
    stickyTop: number;
    bubbleTop: number;
}): number {
    return input.anchorTop + (input.bubbleTop - input.stickyTop);
}
