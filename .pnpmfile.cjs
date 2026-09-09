function readPackage(pkg) {
  if (
    pkg.name === "@prisma/config" &&
    pkg.dependencies &&
    pkg.dependencies["deepmerge-ts"]
  ) {
    pkg.dependencies["deepmerge-ts"] = "^8.0.1";
  }

  if (pkg.name === "prisma" && pkg.dependencies && pkg.dependencies.mysql2) {
    pkg.dependencies.mysql2 = "^3.22.0";
  }

  if (pkg.dependencies?.["fast-uri"]) {
    pkg.dependencies["fast-uri"] = "^3.1.6";
  }

  // Исправление уязвимостей js-yaml
  if (pkg.dependencies?.["js-yaml"]) {
    const version = pkg.dependencies["js-yaml"];
    // Если версия 3.x
    if (version.startsWith("^3") || version.startsWith("~3") || version.startsWith("3")) {
      pkg.dependencies["js-yaml"] = "^3.15.2";
    }
    // Если версия 4.x
    if (version.startsWith("^4") || version.startsWith("~4") || version.startsWith("4")) {
      pkg.dependencies["js-yaml"] = "^4.3.2";
    }
  }

  // Исправление уязвимостей multer
  if (pkg.dependencies?.["multer"]) {
    pkg.dependencies["multer"] = "^2.3.0";
  }

  return pkg;
}

module.exports = { hooks: { readPackage } };