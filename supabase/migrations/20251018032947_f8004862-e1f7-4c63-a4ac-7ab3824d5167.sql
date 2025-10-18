-- Enable realtime for messages table so chat updates in real-time
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;