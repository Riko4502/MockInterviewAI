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

  if (pkg.dependencies?.multer) {
    pkg.dependencies.multer = "^2.4.0";
  }

  if (pkg.dependencies?.uuid) {
    const version = pkg.dependencies.uuid;
    // Если версия 8.x
    if (
      version.startsWith("^8") ||
      version.startsWith("~8") ||
      version.startsWith("8")
    ) {
      pkg.dependencies.uuid = "^11.1.1";
    }
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
    // Если версия 5.x
    if (
      version.startsWith("^5") ||
      version.startsWith("~5") ||
      version.startsWith("5")
    ) {
      pkg.dependencies["js-yaml"] = "^5.4.2";
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

  // Исправление уязвимостей proxy-addr (IP spoofing, GHSA-jqcg-44mw-7w3h)
  if (pkg.dependencies?.["proxy-addr"]) {
    pkg.dependencies["proxy-addr"] = "^2.0.8";
  }

  // Исправление уязвимостей shell-quote (command injection, GHSA-pqg4-j6r4-53mv)
  if (pkg.dependencies?.["shell-quote"]) {
    pkg.dependencies["shell-quote"] = "^1.11.0";
  }

  // Исправление уязвимостей source-map-js (DoS, GHSA-68fv-2mgg-jv7q)
  if (pkg.dependencies?.["source-map-js"]) {
    pkg.dependencies["source-map-js"] = "^1.2.2";
  }

  // Исправление уязвимостей sharp (CVE-2026-96889)
  if (pkg.dependencies?.sharp) {
    pkg.dependencies.sharp = "^0.35.5";
  }
  if (pkg.optionalDependencies?.sharp) {
    pkg.optionalDependencies.sharp = "^0.35.5";
  }

  // Исправление уязвимостей handlebars (GHSA-8r5x-fm3f-whwj, GHSA-p8wg-vrv2-v86f)
  if (pkg.dependencies?.handlebars) {
    pkg.dependencies.handlebars = "^4.7.10";
  }

  return pkg;
}

module.exports = { hooks: { readPackage } };
