CREATE TABLE apresentacoes (
    id VARCHAR(32) PRIMARY KEY,
    razaoSocial VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18) NOT NULL,
    inscricao VARCHAR(50),
    regime VARCHAR(50),
    porte VARCHAR(50),
    ramo VARCHAR(100),
    nomeContato VARCHAR(255) NOT NULL,
    emailCliente VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    cargo VARCHAR(100),
    mensagem TEXT,
    dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    dataAcesso DATETIME,
    acessos INT DEFAULT 0,
    ativo BOOLEAN DEFAULT TRUE
);

CREATE TABLE configuracoes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    emailRemetente VARCHAR(255),
    nomeRemetente VARCHAR(255),
    assuntoEmail VARCHAR(255),
    dataAtualizacao DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_email ON apresentacoes(emailCliente);
CREATE INDEX idx_data ON apresentacoes(dataCriacao);