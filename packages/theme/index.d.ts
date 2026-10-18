type Colors = Record<string, string>

export declare const tokens: { light: Colors; dark: Colors; palette: Colors }
export declare const colorNames: string[]
export declare const nativewindColors: Colors
export declare function themePlugin(options: { dark: 'class' | 'media' }): {
  handler(api: { addBase(styles: Record<string, unknown>): void }): void
}
