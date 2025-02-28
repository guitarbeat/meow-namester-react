-- Drop existing constraints and tables
do $$ 
begin
    if exists (
        select constraint_name 
        from information_schema.table_constraints 
        where table_name = 'cat_names' 
    ) then
        drop table if exists cat_names cascade;
    end if;
    
    if exists (
        select constraint_name 
        from information_schema.table_constraints 
        where table_name = 'name_options' 
    ) then
        drop table if exists name_options cascade;
    end if;

    if exists (
        select constraint_name 
        from information_schema.table_constraints 
        where table_name = 'tournament_progress' 
    ) then
        drop table if exists tournament_progress cascade;
    end if;

    if exists (
        select constraint_name 
        from information_schema.table_constraints 
        where table_name = 'hidden_names' 
    ) then
        drop table if exists hidden_names cascade;
    end if;
end $$;

-- Create the cat_names table
CREATE TABLE public.cat_names (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    elo_rating INTEGER DEFAULT 1500,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    user_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index on user_name for faster lookups
CREATE INDEX cat_names_user_name_idx ON public.cat_names(user_name);

-- Add unique constraint for name and user_name combination
ALTER TABLE public.cat_names 
    ADD CONSTRAINT cat_names_name_user_name_key 
    UNIQUE (name, user_name);

-- Enable Row Level Security
ALTER TABLE public.cat_names ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Public can read cat names" ON public.cat_names
    FOR SELECT
    USING (true);

-- Create policy for public insert/update access
CREATE POLICY "Public can modify cat names" ON public.cat_names
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Create the name_options table
CREATE TABLE public.name_options (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_by TEXT,
    votes_count INTEGER DEFAULT 0,
    average_rating INTEGER DEFAULT 1500,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.name_options ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Public can read name options" ON public.name_options
    FOR SELECT
    USING (true);

-- Create policy for public insert/update access
CREATE POLICY "Public can modify name options" ON public.name_options
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Create the tournament_progress table
CREATE TABLE public.tournament_progress (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_name TEXT NOT NULL UNIQUE,
    round_number INTEGER NOT NULL,
    current_match INTEGER NOT NULL,
    total_matches INTEGER NOT NULL,
    names UUID[] NOT NULL,
    sorter_state JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.tournament_progress ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Users can read their own progress" ON public.tournament_progress
    FOR SELECT
    USING (true);

-- Create policy for public insert/update access
CREATE POLICY "Users can modify their own progress" ON public.tournament_progress
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Insert default cat names
INSERT INTO public.name_options (name) VALUES
    ('Chroma'),
    ('Cosmo'),
    ('Ekko'),
    ('Galileo'),
    ('Ife'),
    ('Ifemi'),
    ('Ivory'),
    ('Moon'),
    ('Mumuye'),
    ('Nova'),
    ('Orion'),
    ('Ozzy'),
    ('Psyche'),
    ('Sol'),
    ('Syzygy'),
    ('Umbra'),
    ('Wumi'),
    ('Zuni'),
    ('Nappy'),
    ('Shawty'),
    ('Toast'),
    ('Orbit')
ON CONFLICT (name) DO NOTHING; 

-- Create hidden_names table
CREATE TABLE IF NOT EXISTS public.hidden_names (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name_id UUID NOT NULL REFERENCES public.name_options(id) ON DELETE CASCADE,
    hidden_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    hidden_by TEXT NOT NULL,
    UNIQUE(name_id)
);

-- Enable RLS
ALTER TABLE public.hidden_names ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Anyone can read hidden names" ON public.hidden_names
    FOR SELECT
    USING (true);

-- Create policy for admin write access
CREATE POLICY "Only admin can modify hidden names" ON public.hidden_names
    FOR ALL
    USING (auth.uid() IN (
        SELECT auth.uid() 
        FROM auth.users 
        WHERE email = 'aaron@example.com'
    ))
    WITH CHECK (auth.uid() IN (
        SELECT auth.uid() 
        FROM auth.users 
        WHERE email = 'aaron@example.com'
    ));

-- Create function for cascading delete
CREATE OR REPLACE FUNCTION public.delete_name_cascade(target_name_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update tournament_progress arrays
    UPDATE public.tournament_progress
    SET names = array_remove(names::UUID[], target_name_id)
    WHERE names::UUID[] @> ARRAY[target_name_id]::UUID[];

    -- Delete from cat_name_ratings
    DELETE FROM public.cat_name_ratings
    WHERE name_id = target_name_id;

    -- Delete from hidden_names
    DELETE FROM public.hidden_names
    WHERE name_id = target_name_id;

    -- Finally delete from name_options
    DELETE FROM public.name_options
    WHERE id = target_name_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error in delete_name_cascade: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_name_cascade TO authenticated; 