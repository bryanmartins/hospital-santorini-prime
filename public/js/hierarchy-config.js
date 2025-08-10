// public/js/hierarchy-config.js

/**
 * Define a estrutura hierárquica explícita baseada em cargos.
 * Mapeia o CARGO do líder para uma lista de CARGOS que ele lidera diretamente.
 */
const leadershipHierarchy = {
    // N2 - Chefes de Ala -> Lideram N1 específicos
    "Chefe de Clínica Geral": ["Clinica Geral"],
    "Chefe de Cirurgia": ["Cirurgia"],
    "Chefe de Enfermagem": ["Enfermagem"],
    "Chefe de Pediatria": ["Pediatria"],
    "Chefe de Obstetrícia": ["Obstetrícia"],
    "Chefe de Psicologia": ["Psicologia"],
    "Chefe de Psiquiatria": ["Psiquiatria"],
    "Chefe de Segurança": ["Segurança"],
    "Chefe de Recepção": ["Recepção"],

    // N4 - Supervisores -> Lideram N2 e N3 específicos
    "Supervisor Clínico": ["Chefe de Clínica Geral", "Chefe de Enfermagem", "Chefe de Cirurgia"],
    "Supervisor Materno-Infantil": ["Chefe de Pediatria", "Chefe de Obstetrícia"],
    "Supervisor de Saúde Mental": ["Chefe de Psicologia", "Chefe de Psiquiatria"],
    "Supervisor de Operações": ["Analista", "Chefe de Recepção", "Chefe de Segurança"], // N3 e N2

    // N5 - Coordenadores -> Lideram N4 específicos
    "Coordenador Clinico": ["Supervisor Clínico", "Supervisor Materno-Infantil"],
    "Coordenador de Operações e Saúde Mental": ["Supervisor de Operações", "Supervisor de Saúde Mental"],

    // N6-N9 -> Lideram o nível imediatamente abaixo
    "Vice-Diretor": ["Coordenador Clinico", "Coordenador de Operações e Saúde Mental"], // Lidera N5
    "Diretor": ["Vice-Diretor"],                      // Lidera N6
    "Vice-Presidente": ["Diretor"],                   // Lidera N7
    "Presidente": ["Vice-Presidente"],                // Lidera N8

    // N10 - Fundador -> Lidera TODOS abaixo de N10 (tratamento especial na função)
    "Fundador": [] // Deixamos vazio, a lógica trata isso
};

/**
 * Verifica se um líder pode avaliar um subordinado com base nos cargos.
 * @param {string} leaderCargo - O cargo do avaliador.
 * @param {string} subordinateCargo - O cargo do funcionário a ser avaliado.
 * @returns {boolean} - True se o líder pode avaliar o subordinado, false caso contrário.
 */
function canEvaluate(leaderCargo, subordinateCargo) {
    if (!leaderCargo || !subordinateCargo) {
        return false; // Cargos inválidos
    }

    // Regra especial para Fundador (N10)
    if (leaderCargo === "Fundador") {
        // Fundador pode avaliar qualquer cargo, exceto outro Fundador
        return subordinateCargo !== "Fundador";
    }

    // Verifica a hierarquia definida no objeto
    const ledCargos = leadershipHierarchy[leaderCargo];
    if (ledCargos && ledCargos.includes(subordinateCargo)) {
        return true;
    }

    // Se não encontrado na liderança direta, retorna false
    return false;
}

console.log("hierarchy-config.js carregado."); // Confirmação de carregamento