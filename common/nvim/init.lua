-- By default title is off. Needed for detecting window as neovim instance (sworkstyle)
vim.cmd "set title"

vim.g.mapleader = ' '
vim.g.maplocalleader = ' '

vim.opt.number = true             -- Line numbers
vim.opt.mouse = 'a'               -- Drag tabs around
vim.opt.showmode = false
vim.opt.clipboard = 'unnamedplus' -- Sync keyboard
vim.opt.breakindent = true        -- Wraps to indent
vim.opt.undofile = true           -- Saves history to a file
vim.opt.updatetime = 250
vim.opt.timeoutlen = 300
vim.opt.splitright = true -- Split right

-- Highlight on search
vim.opt.hlsearch = true
vim.keymap.set('n', '<Esc>', '<cmd>nohlsearch<CR>')

-- Case-insensitive unless capital letters in search term
vim.opt.ignorecase = true
vim.opt.smartcase = true

-- Cursor line highlighting
vim.opt.scrolloff = 10
vim.api.nvim_set_hl(0, "CursorLineNr", { bold = true, italic = true })
vim.opt.cursorlineopt = 'number'
vim.opt.cursorline = true

-- Preview substitutions
vim.opt.inccommand = 'split'

-- Toggle virtual text
local diagnostics_active = false
vim.keymap.set('n', '<leader>d', function()
  diagnostics_active = not diagnostics_active
  if diagnostics_active then
    vim.diagnostic.config({ virtual_text = true })
  else
    vim.diagnostic.config({ virtual_text = false })
  end
end)

-- Ingrained muscle memory
vim.keymap.set('n', '<C-s>', '<cmd>w<cr>')

-- Caves of Qud movement
local movement_map = function(src, dst)
  vim.keymap.set('n', src, dst, { noremap = true, nowait = true, buffer = true })
  vim.keymap.set('v', src, dst, { noremap = true, nowait = true, buffer = true })
end

-- Highlight when yanking (copying) text
vim.api.nvim_create_autocmd('BufEnter', {
  desc = 'Map movement keybindings',
  group = vim.api.nvim_create_augroup('caves-of-qud-movement', { clear = true }),
  callback = function()
    movement_map('h', 'h')
    movement_map('t', 'l')
    movement_map('g', 'k')
    movement_map('m', 'j')
    movement_map('<C-g>', '<C-u>zz')
    movement_map('<C-m>', '<C-d>zz')
    movement_map('<A-g>', '{')
    movement_map('<A-m>', '}')
    movement_map('<A-h>', 'b')
    movement_map('<A-t>', 'w')
  end,
})

-- Arrow keys for buffer movement
vim.keymap.set('n', '<left>', '<C-w><C-h>')
vim.keymap.set('n', '<right>', '<C-w><C-l>')
vim.keymap.set('n', '<down>', '<C-w><C-j>')
vim.keymap.set('n', '<up>', '<C-w><C-k>')

-- Open config
vim.keymap.set('n', '<leader>oc', '<cmd>tabnew ~/.config/nvim/init.lua<cr>')

vim.diagnostic.config({
  virtual_text = false,
  signs = false,
})

-- Filetypes
vim.filetype.add {
  extension = {
    ['slang'] = 'slang'
  }
}

-- Plugins
local lazypath = vim.fn.stdpath 'data' .. '/lazy/lazy.nvim'
if not vim.loop.fs_stat(lazypath) then
  local lazyrepo = 'https://github.com/folke/lazy.nvim.git'
  vim.fn.system { 'git', 'clone', '--filter=blob:none', '--branch=stable', lazyrepo, lazypath }
end ---@diagnostic disable-next-line: undefined-field
vim.opt.rtp:prepend(lazypath)

require('lazy').setup({
  'tpope/vim-sleuth',               -- Detect tabstop and shiftwidth automatically
  'airblade/vim-rooter',            -- Chdir to project root
  'thirtythreeforty/lessspace.vim', -- Strip whitespace
  'junegunn/vim-easy-align',        -- Alignment of comments etc
  {
    "echasnovski/mini.comment",
    opts = {
      mappings = {
        comment = 'cc',
        comment_line = '',
        comment_visual = '<leader>c',
        textobject = 'cc',
      }
    }
  },
  { "echasnovski/mini.pairs", opts = {} },
  { "echasnovski/mini.surround", opts = {} },
  {
    'gbprod/yanky.nvim',
    init = function()
      require('yanky').setup {
        highlight = {
          on_put = true,
          on_yank = true,
          timer = 500,
        },
      }

      vim.keymap.set({'n','x'}, 'p', '<Plug>(YankyPutAfter)')
      vim.keymap.set({'n','x'}, 'P', '<Plug>(YankyPutBefore)')

      vim.keymap.set('n', '<c-p>', '<Plug>(YankyPreviousEntry)')
      vim.keymap.set('n', '<c-n>', '<Plug>(YankyNextEntry)')

      vim.keymap.set({'n','x'}, '<leader>sp', '<Plug>(YankyRingHistory)')
    end,
  },
  {
    'rebelot/kanagawa.nvim',
    priority = 1000,
    init = function()
      vim.cmd.colorscheme 'kanagawa-wave'
      vim.cmd.hi 'Pmenu guibg=none'
      vim.cmd.hi 'Normal guibg=none'
    end,
  },
  { -- Fuzzy Finder (files, lsp, etc)
    'nvim-telescope/telescope.nvim',
    event = 'VimEnter',
    branch = '0.1.x',
    dependencies = {
      'nvim-lua/plenary.nvim',
      'nvim-telescope/telescope-ui-select.nvim',
      { -- If encountering errors, see telescope-fzf-native README for installation instructions
        'nvim-telescope/telescope-fzf-native.nvim',

        -- `build` is used to run some command when the plugin is installed/updated.
        -- This is only run then, not every time Neovim starts up.
        build = 'make',

        -- `cond` is a condition used to determine whether this plugin should be
        -- installed and loaded.
        cond = function()
          return vim.fn.executable 'make' == 1
        end,
      },
      -- Useful for getting pretty icons, but requires a Nerd Font.
      { 'nvim-tree/nvim-web-devicons' },
      { 'rish987/telescope-repo.nvim', branch = 'cwd-fix' },
    },
    config = function()
      require('telescope').setup {
        defaults = { layout_strategy = 'bottom_pane' },
        extensions = {
          ['ui-select'] = {
            require('telescope.themes').get_cursor()
          }
        },
      }

      -- Enable Telescope extensions if they are installed
      pcall(require('telescope').load_extension, 'fzf')
      pcall(require('telescope').load_extension, 'repo')
      pcall(require('telescope').load_extension, 'ui-select')

      -- See `:help telescope.builtin`
      local builtin = require 'telescope.builtin'
      local extensions = require('telescope').extensions
      vim.keymap.set('n', '<leader>sh', builtin.help_tags, { desc = '[S]earch [H]elp' })
      vim.keymap.set('n', '<leader>sk', builtin.keymaps, { desc = '[S]earch [K]eymaps' })
      vim.keymap.set('n', '<leader>sf', builtin.find_files, { desc = '[S]earch [F]iles' })
      vim.keymap.set('n', '<leader>ss', builtin.builtin, { desc = '[S]earch [S]elect Telescope' })
      vim.keymap.set('n', '<leader>sw', builtin.grep_string, { desc = '[S]earch current [W]ord' })
      vim.keymap.set('n', '<leader>sg', builtin.live_grep, { desc = '[S]earch by [G]rep' })
      vim.keymap.set('n', '<leader>sd', builtin.diagnostics, { desc = '[S]earch [D]iagnostics' })
      vim.keymap.set('n', '<leader>sr', builtin.resume, { desc = '[S]earch [R]esume' })
      vim.keymap.set('n', '<leader>s.', builtin.oldfiles, { desc = '[S]earch Recent Files ("." for repeat)' })
      vim.keymap.set('n', '<leader><leader>', builtin.buffers, { desc = '[ ] Find existing buffers' })

      vim.keymap.set('n', '<leader>sr', function()
        extensions.repo.list {
          search_paths = {'~/dev', '~/src' }
        }
      end, { desc = '[S]earch [R]epos' })

      vim.keymap.set('n', '<leader>sP', function()
        builtin.commands(require('telescope.themes').get_ivy {
          winblend = 10,
          previewer = false,
        })
      end, { desc = '[S]earch command [P]alette' })

      vim.keymap.set('n', '<leader>/', function()
        builtin.current_buffer_fuzzy_find(require('telescope.themes').get_ivy {
          winblend = 10,
          previewer = false,
        })
      end, { desc = '[/] Fuzzily search in current buffer' })

      -- It's also possible to pass additional configuration options.
      --  See `:help telescope.builtin.live_grep()` for information about particular keys
      vim.keymap.set('n', '<leader>s/', function()
        builtin.live_grep {
          grep_open_files = true,
          prompt_title = 'Live Grep in Open Files',
        }
      end, { desc = '[S]earch [/] in Open Files' })

      -- Shortcut for searching your Neovim configuration files
      vim.keymap.set('n', '<leader>sn', function()
        builtin.find_files { cwd = vim.fn.stdpath 'config' }
      end, { desc = '[S]earch [N]eovim files' })
    end,
  },
  { -- LSP Configuration & Plugins
    'neovim/nvim-lspconfig',
    dependencies = {
      'lukas-reineke/lsp-format.nvim',

      -- Useful status updates for LSP.
      -- NOTE: `opts = {}` is the same as calling `require('fidget').setup({})`
      { 'j-hui/fidget.nvim', opts = {} },

      -- `neodev` configures Lua LSP for your Neovim config, runtime and plugins
      -- used for completion, annotations and signatures of Neovim apis
      { 'folke/neodev.nvim', opts = {} },

      { 'folke/trouble.nvim' },
      { 'aznhe21/actions-preview.nvim', opts = {} },
    },
    config = function()
      local on_attach = require('lsp-format').on_attach

      require('lspconfig').lua_ls.setup {}
      require('lspconfig').rust_analyzer.setup {
        on_attach = on_attach,
        settings = {
          ['rust-analyzer'] = {
            cargo = {
              features = 'all'
            },
            check = {
              command = 'clippy'
            }
          }
        }
      }

      require('lspconfig').slangd.setup {
        filetypes = { 'slang' }
      }

      -- Diagnostic movement
      local trouble = require('trouble');
      trouble.setup { auto_close = true }

      local trouble_bufsetup = function()
        if trouble.is_open() then
          vim.opt_local.cursorline = true;
          vim.opt_local.cursorlineopt = 'both';
        end
      end

      vim.keymap.set('n', '<leader>e', function()
        trouble.toggle()
        trouble_bufsetup()
      end, { desc = 'Show diagnostic [E]rror messages'})

      vim.keymap.set('n', '<A-[>', function()
        if #vim.diagnostic.get() > 0 then
          trouble.open()
          trouble_bufsetup()
          trouble.previous({ skip_groups = true, jump = true })
        end
      end, { nowait = true, desc = 'Go to previous diagnostic message'})

      vim.keymap.set('n', '<A-]>', function()
        if #vim.diagnostic.get() > 0 then
          trouble.open()
          trouble_bufsetup()
          trouble.next({ skip_groups = true, jump = true })
        end
      end, { nowait = true, desc = 'Go to next diagnostic message'})

      vim.api.nvim_create_autocmd('LspAttach', {
        group = vim.api.nvim_create_augroup('kickstart-lsp-attach', { clear = true }),
        callback = function(event)
          local map = function(keys, func, desc)
            vim.keymap.set('n', keys, func, { buffer = event.buf, desc = 'LSP: ' .. desc })
          end

          local telescope = require('telescope.builtin')
          map('<leader>gd', telescope.lsp_definitions, '[G]oto [D]efinition')
          map('<leader>gr', telescope.lsp_references, '[G]oto [R]eferences')
          map('<leader>gI', telescope.lsp_implementations, '[G]oto [I]mplementation')
          map('<leader>D', telescope.lsp_type_definitions, 'Type [D]efinition')
          map('<leader>ds', telescope.lsp_document_symbols, '[D]ocument [S]ymbols')
          map('<leader>ws', telescope.lsp_dynamic_workspace_symbols, '[W]orkspace [S]ymbols')
          map('<leader>rn', vim.lsp.buf.rename, '[R]e[n]ame')
          map('<leader>ca', vim.lsp.buf.code_action, '[C]ode [A]ction')
          map('K', vim.lsp.buf.hover, 'Hover Documentation')
          map('<leader>gD', vim.lsp.buf.declaration, '[G]oto [D]eclaration')

          map('<leader>F', '<cmd>Format<cr>', '[F]ormat document')
          vim.cmd [[cabbrev wq execute "Format sync" <bar> wq]]

          map('<leader>ff', function()
            vim.lsp.buf.code_action {
              filter = function(ca)
                return ca.isPreferred
              end,
              apply = true,
            }
          end, '[F]ast [F]ix')

          -- The following two autocommands are used to highlight references of the
          -- word under your cursor when your cursor rests there for a little while.
          --    See `:help CursorHold` for information about when this is executed
          --
          -- When you move your cursor, the highlights will be cleared (the second autocommand).
          local client = vim.lsp.get_client_by_id(event.data.client_id)
          if client and client.server_capabilities.documentHighlightProvider then
            vim.api.nvim_create_autocmd({ 'CursorHold', 'CursorHoldI' }, {
              buffer = event.buf,
              callback = vim.lsp.buf.document_highlight,
            })

            vim.api.nvim_create_autocmd({ 'CursorMoved', 'CursorMovedI' }, {
              buffer = event.buf,
              callback = vim.lsp.buf.clear_references,
            })
          end
        end,
      })

      -- LSP servers and clients are able to communicate to each other what features they support.
      --  By default, Neovim doesn't support everything that is in the LSP specification.
      --  When you add nvim-cmp, luasnip, etc. Neovim now has *more* capabilities.
      --  So, we create new capabilities with nvim cmp, and then broadcast that to the servers.
      local capabilities = vim.lsp.protocol.make_client_capabilities()
      capabilities = vim.tbl_deep_extend('force', capabilities, require('cmp_nvim_lsp').default_capabilities())

      -- Format-on-save.
      require('lsp-format').setup()
    end
  },
  { -- Autocompletion
    'hrsh7th/nvim-cmp',
    event = 'InsertEnter',
    dependencies = {
      -- Adds other completion capabilities.
      --  nvim-cmp does not ship with all sources by default. They are split
      --  into multiple repos for maintenance purposes.
      'hrsh7th/cmp-nvim-lsp',
      'hrsh7th/cmp-path',
      { 'L3MON4D3/LuaSnip', build = "make install_jsregexp" },
      'saadparwaiz1/cmp_luasnip',
    },
    config = function()
      -- See `:help cmp`
      local cmp = require 'cmp'

      cmp.setup {
        window = {
          completion = { border = 'rounded' },
          documentation = { border = 'rounded' }
        },
        snippet = {
          expand = function(args)
            require('luasnip').lsp_expand(args.body)
          end
        },
        completion = { completeopt = 'menu,menuone,noinsert' },

        -- For an understanding of why these mappings were
        -- chosen, you will need to read `:help ins-completion`
        --
        -- No, but seriously. Please read `:help ins-completion`, it is really good!
        mapping = cmp.mapping.preset.insert {
          -- Select the [n]ext item
          ['<C-n>'] = cmp.mapping.select_next_item(),
          -- Select the [p]revious item
          ['<C-p>'] = cmp.mapping.select_prev_item(),

          ['<PageUp>'] = cmp.mapping.scroll_docs(-4),
          ['<PageDown>'] = cmp.mapping.scroll_docs(4),
          ['<CR>'] = cmp.mapping.confirm { select = true },

          -- Manually trigger a completion from nvim-cmp.
          --  Generally you don't need this, because nvim-cmp will display
          --  completions whenever it has completion options available.
          ['<C-Tab>'] = cmp.mapping.complete {},
        },
        sources = {
          { name = 'nvim_lsp' },
          { name = 'path' },
        },
      }
    end,
  },
})

-- vim: ts=2 sts=2 sw=2 et
