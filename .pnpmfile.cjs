function readPackage(pkg) {
  if (
    pkg.name === "@prisma/config" &&
    pkg.dependencies &&
    pkg.dependencies["deepmerge-ts"]
  ) {
    pkg.dependencies["deepmerge-ts"] = "^8.0.1";
  }

  if (
    pkg.name === "prisma" &&
    pkg.dependencies &&
    pkg.dependencies["mysql2"]
  ) {
    pkg.dependencies["mysql2"] = "^3.22.0";
  }

  return pkg;
}

module.exports = { hooks: { readPackage } };
