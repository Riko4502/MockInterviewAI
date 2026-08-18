function readPackage(pkg) {
  if (
    pkg.name === "@prisma/config" &&
    pkg.dependencies &&
    pkg.dependencies["deepmerge-ts"]
  ) {
    pkg.dependencies["deepmerge-ts"] = "^8.0.1";
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
