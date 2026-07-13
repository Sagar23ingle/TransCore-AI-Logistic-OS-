
-- Documents bucket: files are stored under <owner_uuid>/<...>
CREATE POLICY "Owner reads own document files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.current_user_is_admin()));

CREATE POLICY "Owner uploads own document files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner updates own document files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner deletes own document files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
