#!/bin/bash
set -e

echo "🐝 Installing Bumblebee GUI..."

# Detect platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$OS" in
    darwin)
        case "$ARCH" in
            arm64) PLATFORM="darwin_arm64" ;;
            x86_64) PLATFORM="darwin_amd64" ;;
            *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
        esac
        ;;
    linux)
        case "$ARCH" in
            x86_64) PLATFORM="linux_amd64" ;;
            aarch64) PLATFORM="linux_arm64" ;;
            *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
        esac
        ;;
    *)
        echo "Unsupported OS: $OS"
        exit 1
        ;;
esac

echo "Detected platform: $PLATFORM"

# Create installation directory
INSTALL_DIR="$HOME/.bumblebee-gui"
mkdir -p "$INSTALL_DIR/bin"

# Download Bumblebee binary
BUMBLEBEE_VERSION="0.1.1"
BUMBLEBEE_URL="https://github.com/perplexityai/bumblebee/releases/download/v${BUMBLEBEE_VERSION}/bumblebee_${BUMBLEBEE_VERSION}_${PLATFORM}.tar.gz"

echo "Downloading Bumblebee v${BUMBLEBEE_VERSION}..."
curl -L "$BUMBLEBEE_URL" | tar -xz -C "$INSTALL_DIR/bin/"

# Download Bumblebee GUI
GUI_VERSION="0.1.0"
GUI_URL="https://github.com/user/bumblebee-gui/releases/download/v${GUI_VERSION}/bumblebee-gui_${GUI_VERSION}_${PLATFORM}.tar.gz"

echo "Downloading Bumblebee GUI v${GUI_VERSION}..."
curl -L "$GUI_URL" | tar -xz -C "$INSTALL_DIR/"

# Create launcher script
cat > "$INSTALL_DIR/bin/bumblebee-gui" << 'EOF'
#!/bin/bash
cd "$HOME/.bumblebee-gui"
python3 -m bumblebee_gui "$@"
EOF
chmod +x "$INSTALL_DIR/bin/bumblebee-gui"

# Add to PATH if not already there
SHELL_RC="$HOME/.bashrc"
[ -f "$HOME/.zshrc" ] && SHELL_RC="$HOME/.zshrc"

if ! grep -q ".bumblebee-gui/bin" "$SHELL_RC"; then
    echo 'export PATH="$HOME/.bumblebee-gui/bin:$PATH"' >> "$SHELL_RC"
    echo "Added to PATH in $SHELL_RC"
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "To start Bumblebee GUI:"
echo "  source $SHELL_RC"
echo "  bumblebee-gui"
echo ""
echo "Or run directly:"
echo "  $INSTALL_DIR/bin/bumblebee-gui"
