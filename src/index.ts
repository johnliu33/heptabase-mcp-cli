import { Command } from 'commander';
import { createAuthCommand } from './cli/commands/auth.js';
import { createSearchCommand } from './cli/commands/search.js';
import { createWhiteboardCommand } from './cli/commands/whiteboard.js';
import { createObjectCommand } from './cli/commands/object.js';
import { createInteractiveCommand } from './cli/commands/interactive.js';
import { createJournalCommand } from './cli/commands/journal.js';
import { createSaveCommand } from './cli/commands/save.js';
import { createPdfCommand } from './cli/commands/pdf.js';
import { createTuiCommand } from './cli/commands/tui.js';
import { createWorkflowCommand } from './cli/commands/workflow.js';
import { logger } from './utils/logger.js';

const program = new Command();

program
  .name('heptabase')
  .description('Heptabase Extension — 透過官方 MCP 搜尋、讀取和寫入 Heptabase 內容')
  .version('2.0.0')
  .option('--verbose', '顯示詳細日誌', false)
  .hook('preAction', (thisCommand) => {
    if (thisCommand.opts().verbose) {
      logger.setLevel('debug');
    }
  });

program.addCommand(createAuthCommand());
program.addCommand(createSearchCommand());
program.addCommand(createWhiteboardCommand());
program.addCommand(createObjectCommand());
program.addCommand(createJournalCommand());
program.addCommand(createSaveCommand());
program.addCommand(createPdfCommand());
program.addCommand(createInteractiveCommand());
program.addCommand(createTuiCommand());
program.addCommand(createWorkflowCommand());

program.parse();
