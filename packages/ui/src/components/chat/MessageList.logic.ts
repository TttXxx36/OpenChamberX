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
