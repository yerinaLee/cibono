insert into app_user (id, email, password_hash)
values (1, 'mvp@local', 'noop')
    on conflict (email) do nothing;
