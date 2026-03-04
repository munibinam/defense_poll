-- Create the responses table for the defense poll app
CREATE TABLE IF NOT EXISTS responses (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slots TEXT[] NOT NULL,
  mode TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create an index for faster queries
CREATE INDEX IF NOT EXISTS idx_responses_timestamp ON responses(timestamp);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows anyone to read responses
CREATE POLICY "Allow public read" ON responses
  FOR SELECT
  USING (true);

-- Create a policy that allows anyone to insert responses  
CREATE POLICY "Allow public insert" ON responses
  FOR INSERT
  WITH CHECK (true);

-- Create a policy that allows anyone to delete responses (for admin)
CREATE POLICY "Allow public delete" ON responses
  FOR DELETE
  USING (true);

-- Create a policy that allows anyone to update responses
CREATE POLICY "Allow public update" ON responses
  FOR UPDATE
  USING (true);