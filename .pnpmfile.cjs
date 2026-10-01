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
    pkg.dependencies["fast-uri"] = "^3.1.8";
  }

  // Исправление уязвимостей js-yaml
  if (pkg.dependencies?.["js-yaml"]) {
    const version = pkg.dependencies["js-yaml"];
    // Если версия 3.x
    if (
      version.startsWith("^3") ||
      version.startsWith("~3") ||
      version.startsWith("3")
    ) {
      pkg.dependencies["js-yaml"] = "^3.15.2";
    }
    // Если версия 4.x
    if (
      version.startsWith("^4") ||
      version.startsWith("~4") ||
      version.startsWith("4")
    ) {
      pkg.dependencies["js-yaml"] = "^4.3.2";
    }
  }

  // Исправление уязвимостей joi
  if (pkg.dependencies?.joi) {
    const version = pkg.dependencies.joi;
    if (
      version.startsWith("^17") ||
      version.startsWith("~17") ||
      version.startsWith("17")
    ) {
      pkg.dependencies.joi = "^17.13.7";
    } else if (
      version.startsWith("^18") ||
      version.startsWith("~18") ||
      version.startsWith("18")
    ) {
      pkg.dependencies.joi = "^18.2.9";
    }
  }

  // Исправление уязвимостей brace-expansion
  if (pkg.dependencies?.["brace-expansion"]) {
    const version = pkg.dependencies["brace-expansion"];
    if (
      version.startsWith("^1") ||
      version.startsWith("~1") ||
      version.startsWith("1")
    ) {
      pkg.dependencies["brace-expansion"] = "^1.1.21";
    } else if (
      version.startsWith("^2") ||
      version.startsWith("~2") ||
      version.startsWith("2")
    ) {
      pkg.dependencies["brace-expansion"] = "^2.1.7";
    } else if (
      version.startsWith("^4") ||
      version.startsWith("~4") ||
      version.startsWith("4") ||
      version.startsWith("^5") ||
      version.startsWith("~5") ||
      version.startsWith("5")
    ) {
      pkg.dependencies["brace-expansion"] = "^5.0.12";
    }
  }

  return pkg;
}

module.exports = { hooks: { readPackage } };
