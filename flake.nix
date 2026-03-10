{
  description = "Entorno de desarrollo para POS Minimalista";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
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
            nodejs_20
            nodePackages.npm
            nodePackages.typescript
            postgresql # Para comandos como psql si los necesitas
          ];

          shellHook = ''
            echo "--- Entorno POS Minimalista Activado ---"
            echo "Node version: $(node -v)"
            echo "Recuerda: Usa 'npm run dev' para iniciar SvelteKit"
          '';
        };
      });
}