// ── Supabase client ───────────────────────────────────────────────
var _sb = null;
function getDb() {
  if (!_sb) _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  return _sb;
}

var DB = {

  // ── Auth ──────────────────────────────────────────────────────
  async loginWithDiscord() {
    return getDb().auth.signInWithOAuth({
      provider: 'discord',
      options: {
        scopes: 'identify guilds.members.read',
        redirectTo: 'https://louiis-hub.github.io/bcso-intranet/'
      }
    });
  },
  async logout() { return getDb().auth.signOut(); },
  async getSession() { return getDb().auth.getSession(); },
  onAuthChange(cb) { return getDb().auth.onAuthStateChange(cb); },

  // ── App users (admin/academy roles) ──────────────────────────
  async getAppUser(userId) {
    var { data } = await getDb().from('app_users').select('*').eq('user_id', userId).single();
    return data;
  },
  async getAppUsers() {
    var { data } = await getDb().from('app_users').select('*').order('nom');
    return data || [];
  },
  async upsertAppUser(data) {
    return getDb().from('app_users').upsert(data, { onConflict: 'user_id' });
  },
  async updateAppUserRole(id, role) {
    return getDb().from('app_users').update({ app_role: role }).eq('id', id);
  },

  // ── Agents ───────────────────────────────────────────────────
  async getAgents(filters) {
    filters = filters || {};
    var q = getDb().from('agents').select('*').order('nom').order('prenom');
    if (filters.statut) q = q.eq('statut', filters.statut);
    if (filters.grade)  q = q.eq('grade', filters.grade);
    if (filters.unite)  q = q.contains('unites', [filters.unite]);
    if (filters.search) {
      var s = filters.search;
      q = q.or('nom.ilike.%' + s + '%,prenom.ilike.%' + s + '%,matricule.ilike.%' + s + '%');
    }
    var { data } = await q;
    return data || [];
  },
  async getAgent(id) {
    var { data } = await getDb().from('agents').select('*').eq('id', id).single();
    return data;
  },
  async createAgent(data) {
    return getDb().from('agents').insert(data).select().single();
  },
  async updateAgent(id, data) {
    data.updated_at = new Date().toISOString();
    return getDb().from('agents').update(data).eq('id', id);
  },

  // ── Grades ───────────────────────────────────────────────────
  async getGrades() {
    var { data } = await getDb().from('grades').select('*').order('ordre');
    return data || [];
  },
  async createGrade(data) { return getDb().from('grades').insert(data); },
  async updateGrade(id, data) { return getDb().from('grades').update(data).eq('id', id); },
  async deleteGrade(id) { return getDb().from('grades').delete().eq('id', id); },

  // ── Units ────────────────────────────────────────────────────
  async getUnits() {
    var { data } = await getDb().from('units').select('*').order('code');
    return data || [];
  },
  async updateUnit(id, data) { return getDb().from('units').update(data).eq('id', id); },

  // ── Agent history ────────────────────────────────────────────
  async getHistory(agentId) {
    var { data } = await getDb().from('agent_historique')
      .select('*').eq('agent_id', agentId).order('date', { ascending: false });
    return data || [];
  },
  async addHistory(data) { return getDb().from('agent_historique').insert(data); },
  async deleteHistory(id) { return getDb().from('agent_historique').delete().eq('id', id); },

  // ── Disciplinary ─────────────────────────────────────────────
  async getDisciplinary(filters) {
    filters = filters || {};
    var q = getDb().from('dossiers_disciplinaires')
      .select('*, agent:agent_id(nom,prenom,matricule,grade)')
      .order('date', { ascending: false });
    if (filters.agentId) q = q.eq('agent_id', filters.agentId);
    if (filters.search)  q = q.ilike('motif', '%' + filters.search + '%');
    var { data } = await q;
    return data || [];
  },
  async createDisciplinary(data) { return getDb().from('dossiers_disciplinaires').insert(data); },
  async updateDisciplinary(id, data) { return getDb().from('dossiers_disciplinaires').update(data).eq('id', id); },
  async deleteDisciplinary(id) { return getDb().from('dossiers_disciplinaires').delete().eq('id', id); },

  // ── MDT ──────────────────────────────────────────────────────
  async getMdtCategories() {
    var { data } = await getDb().from('mdt_categories').select('*').order('ordre').order('nom');
    return data || [];
  },
  async getMdtPages(catId) {
    var { data } = await getDb().from('mdt_pages')
      .select('id,titre,ordre,updated_at').eq('categorie_id', catId).order('ordre').order('titre');
    return data || [];
  },
  async getMdtPage(id) {
    var { data } = await getDb().from('mdt_pages').select('*').eq('id', id).single();
    return data;
  },
  async createMdtCategory(data) {
    return getDb().from('mdt_categories').insert(data).select().single();
  },
  async updateMdtCategory(id, data) { return getDb().from('mdt_categories').update(data).eq('id', id); },
  async deleteMdtCategory(id) { return getDb().from('mdt_categories').delete().eq('id', id); },
  async createMdtPage(data) { return getDb().from('mdt_pages').insert(data).select().single(); },
  async updateMdtPage(id, data) {
    data.updated_at = new Date().toISOString();
    return getDb().from('mdt_pages').update(data).eq('id', id);
  },
  async deleteMdtPage(id) { return getDb().from('mdt_pages').delete().eq('id', id); },

  // ── Stats ────────────────────────────────────────────────────
  async getStats() {
    var d30 = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
    var [ag, hist, disc] = await Promise.all([
      getDb().from('agents').select('grade,statut,ppa1,ppa2,ppa3,qual_pa,qual_cid,qual_swat,qual_tu,qual_prd,unites'),
      getDb().from('agent_historique').select('type,date').gte('date', d30),
      getDb().from('dossiers_disciplinaires').select('id').gte('date', d30)
    ]);
    return { agents: ag.data || [], recentHist: hist.data || [], recentDisc: disc.data || [] };
  },

  // ── Search ───────────────────────────────────────────────────
  async search(q) {
    if (!q || q.length < 2) return { agents: [], mdt: [], disc: [] };
    var [ag, mdt, disc] = await Promise.all([
      getDb().from('agents').select('id,nom,prenom,matricule,grade,statut')
        .or('nom.ilike.%' + q + '%,prenom.ilike.%' + q + '%,matricule.ilike.%' + q + '%').limit(8),
      getDb().from('mdt_pages').select('id,titre,categorie_id').ilike('titre', '%' + q + '%').limit(6),
      getDb().from('dossiers_disciplinaires')
        .select('id,motif,date,agent:agent_id(nom,prenom)').ilike('motif', '%' + q + '%').limit(5)
    ]);
    return { agents: ag.data || [], mdt: mdt.data || [], disc: disc.data || [] };
  }
};
