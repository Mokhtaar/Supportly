-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "chat_widget_config" JSONB NOT NULL DEFAULT '{"primary_color": "#3B82F6", "initial_greeting": "Hi! How can I help you today?", "position": "bottom-right"}';
