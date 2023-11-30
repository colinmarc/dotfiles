# Tailscale
alias tailscale=/Applications/Tailscale.app/Contents/MacOS/Tailscale

# Homebrew
eval "$(/opt/homebrew/bin/brew shellenv)"

# VS Code
export PATH="$PATH:/Applications/Visual Studio Code.app/Contents/Resources/app/bin"

# Vulkan
export VULKAN_SDK="/opt/vulkan/1.3.261.1/macOS"
export PATH="$VULKAN_SDK/bin:$PATH"
export DYLD_LIBRARY_PATH="$VULKAN_SDK/lib:$DYLD_LIBRARY_PATH"
export VK_ICD_FILENAMES="$VULKAN_SDK/share/vulkan/icd.d/MoltenVK_icd.json"
export VK_ADD_LAYER_PATH="$VULKAN_SDK/share/vulkan/explicit_layer.d"
export VK_DRIVER_FILES="$VULKAN_SDK/share/vulkan/icd.d/MoltenVK_icd.json"

export GPG_TTY=$(tty)
export SSH_AUTH_SOCK=/Users/colinmarc/Library/Containers/com.maxgoedjen.Secretive.SecretAgent/Data/socket.ssh
