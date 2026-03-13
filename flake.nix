{
  description = "POS mdfz";

  inputs = {
    # Usamos la rama estable que tiene mejores binarios para Mac
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, utils }:
    utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_20           # Node estándar (no slim)
            nodePackages.npm
            nodePackages.typescript
            postgresql_16
          ];

          shellHook = ''
            echo "--- Entorno POS Activado (Vía Caché) ---"
            node -v
          '';
        };
      });
}