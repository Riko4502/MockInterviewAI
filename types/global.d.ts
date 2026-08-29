declare module "*.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

declare module "*.scss" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

declare module "*.sass" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
