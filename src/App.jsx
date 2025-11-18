import React, { useState, useRef, useEffect, useMemo } from 'react'
import Groq from 'groq-sdk'

// MUDANÇA 1: Importar Firebase
import { db, doc, getDoc, setDoc, onSnapshot, updateDoc } from './firebase'
import { nanoid } from 'nanoid' // Para gerar IDs de jogos únicos

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPalette,
  faFlask,
  faFutbol,
  faGlobe,
  faTicket,
  faLandmark,
  faUser, // Novo ícone para jogador
  faUserGroup // Novo ícone para multiplayer
} from '@fortawesome/free-solid-svg-icons'

// --- Configuração das Categorias ---
// MUDANÇA 2: lastQuestions como objeto de histórico por categoria
const lastQuestions = {
  art: [],
  science: [],
  sports: [],
  geography: [],
  entertainment: [],
  history: []
}
const categories = [
  {
    id: 'art',
    name: 'Arte',
    color: 'bg-red-500',
    icon: faPalette
  },
  {
    id: 'science',
    name: 'Ciência',
    color: 'bg-green-500',
    icon: faFlask
  },
  {
    id: 'sports',
    name: 'Esporte',
    color: 'bg-blue-500',
    icon: faFutbol
  },
  {
    id: 'geography',
    name: 'Geografia',
    color: 'bg-yellow-500',
    icon: faGlobe
  },
  {
    id: 'entertainment',
    name: 'Entretenimento',
    color: 'bg-pink-500',
    icon: faTicket
  },
  {
    id: 'history',
    name: 'História',
    color: 'bg-purple-500',
    icon: faLandmark
  }
]

export default function App () {
  // --- ESTADOS DO JOGO ---
  const [scores, setScores] = useState({
    art: 0,
    science: 0,
    sports: 0,
    geography: 0,
    entertainment: 0,
    history: 0
  })
  const [spinningIndex, setSpinningIndex] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [result, setResult] = useState(null)
  const [gameState, setGameState] = useState('idle') // idle, spinning, question, result, versus-menu, waiting
  const [error, setError] = useState(null)

  // --- ESTADOS DO VERSUS ---
  const [gameId, setGameId] = useState('') // ID da sala (Game Session)
  const [isHost, setIsHost] = useState(false) // Indica se é o criador da sala
  const [isPlayerOne, setIsPlayerOne] = useState(true) // Qual jogador sou (P1 ou P2)
  const [playerName, setPlayerName] = useState('')
  const [opponentName, setOpponentName] = useState(null)
  const [playerScores, setPlayerScores] = useState({ player1: 0, player2: 0 })
  const [lastSyncedQuestion, setLastSyncedQuestion] = useState(null)
  const [lastSyncedResult, setLastSyncedResult] = useState(null)

  const spinIntervalRef = useRef(null)

  // --- CONFIGURAÇÃO DA API KEY ---
  const rawApiKey = process.env.REACT_APP_GROQ_API_KEY
  const [apiKey, setApiKey] = useState(undefined)

  useEffect(() => {
    if (!rawApiKey || rawApiKey === 'undefined') {
      setError(
        'A chave da API Groq não está configurada. Verifique o ficheiro .env.local.'
      )
      setApiKey(null)
    } else {
      setError(null)
      setApiKey(rawApiKey)
    }
  }, [rawApiKey])

  const groqClient = useMemo(() => {
    if (apiKey) {
      return new Groq({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      })
    }
    return null
  }, [apiKey])

  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current)
      }
    }
  }, [])

  // --- FUNÇÕES FIREBASE ---

  // 4.1. Sincronizar estado do jogo e pontuações
  useEffect(() => {
    if (!gameId) return

    const gameDocRef = doc(db, 'games', gameId)

    const unsubscribe = onSnapshot(gameDocRef, snapshot => {
      if (snapshot.exists()) {
        const gameData = snapshot.data()

        // Sincronizar Pontuações
        setPlayerScores({
          player1: gameData.player1Score,
          player2: gameData.player2Score
        })

        // Sincronizar oponente (se não for o host)
        if (!isHost) {
          setOpponentName(gameData.player1Name)
        }

        // Se for o host, atualizar o nome do oponente (P2)
        if (isHost) {
          setOpponentName(gameData.player2Name)
        }

        // Sincronizar Pergunta/Resultado
        if (gameData.currentQuestion && gameData.currentQuestion.pergunta) {
          if (gameData.currentQuestion.pergunta !== currentQuestion?.pergunta) {
            setCurrentQuestion(gameData.currentQuestion)
            setSelectedCategory(
              categories.find(c => c.id === gameData.selectedCategory)
            )
            setGameState('question')
            setResult(null) // Limpa o resultado anterior para a nova pergunta
            setLastSyncedResult(null)
          }
        } else if (gameData.lastResult) {
          // Se não há pergunta, mas há resultado, mostre o resultado
          setLastSyncedResult(gameData.lastResult)
          setGameState('result')
        } else if (!gameData.currentQuestion && !gameData.lastResult) {
          setGameState(gameData.gameState)
        }
      } else {
        // Se o documento não existe, a sessão foi terminada
        alert('A sessão do jogo terminou ou não foi encontrada.')
        resetGame()
      }
    })

    return () => unsubscribe()
  }, [gameId])

  // 4.2. Criar uma nova sala (Host)
  const createGame = async () => {
    if (!playerName) {
      setError('Por favor, digite seu nome.')
      return
    }

    const newGameId = nanoid(6).toUpperCase()
    const gameRef = doc(db, 'games', newGameId)

    const initialGameData = {
      player1Name: playerName,
      player1Score: 0,
      player2Name: null,
      player2Score: 0,
      currentQuestion: null,
      selectedCategory: null,
      gameState: 'waiting' // Estado inicial: esperando jogador 2
    }

    try {
      await setDoc(gameRef, initialGameData)
      setGameId(newGameId)
      setIsHost(true)
      setIsPlayerOne(true)
      setGameState('waiting')
      setError(null)
    } catch (e) {
      console.error('Erro ao criar sala:', e)
      setError('Falha ao criar sala. Tente novamente.')
    }
  }

  // 4.3. Juntar-se a uma sala (Guest)
  const joinGame = async () => {
    if (!playerName || !gameId) {
      setError('Por favor, digite seu nome e o ID da sala.')
      return
    }

    const gameRef = doc(db, 'games', gameId)

    try {
      const docSnap = await getDoc(gameRef)

      if (docSnap.exists() && !docSnap.data().player2Name) {
        // Entra como Jogador 2
        await updateDoc(gameRef, {
          player2Name: playerName,
          gameState: 'idle' // Jogo pronto para começar
        })

        setIsHost(false)
        setIsPlayerOne(false)
        setGameState('idle')
        setError(null)
        setOpponentName(docSnap.data().player1Name) // Pega o nome do Host
      } else if (docSnap.exists() && docSnap.data().player2Name) {
        setError('Sala cheia ou jogo em andamento.')
      } else {
        setError('Sala de jogo não encontrada.')
      }
    } catch (e) {
      console.error('Erro ao entrar na sala:', e)
      setError('Falha ao entrar na sala. Tente novamente.')
    }
  }

  // 4.4. Resetar (Limpar estados)
  const resetGame = () => {
    setScores({
      art: 0,
      science: 0,
      sports: 0,
      geography: 0,
      entertainment: 0,
      history: 0
    })
    setGameId('')
    setIsHost(false)
    setIsPlayerOne(true)
    setPlayerName('')
    setOpponentName(null)
    setPlayerScores({ player1: 0, player2: 0 })
    setGameState('versus-menu') // Volta para o menu versus
    setCurrentQuestion(null)
    setResult(null)
    setSpinningIndex(null)
    setError(null)
    setLastSyncedQuestion(null)
    setLastSyncedResult(null)
  }

  // --- LÓGICA PRINCIPAL (ADAPTADA) ---

  const spinWheel = async () => {
    // Apenas o HOST pode girar a roleta
    if (gameId && !isHost) {
      setError('Apenas o host pode girar a roleta no modo versus.')
      return
    }

    // ... (O restante da lógica de animação da roleta permanece igual,
    // mas a chamada final para fetchQuestion é adaptada para multiplayer) ...

    // ... (Mantendo a lógica anterior do spin)
    if (!groqClient) {
      setError('A chave da API Groq não está configurada.')
      return
    }

    setGameState('spinning')
    setCurrentQuestion(null)
    setResult(null)
    setError(null)
    setSelectedCategory(null)

    const spinDuration = 3000
    const spinInterval = 100
    let currentSpinIndex = 0

    spinIntervalRef.current = setInterval(() => {
      setSpinningIndex(currentSpinIndex % categories.length)
      currentSpinIndex++
    }, spinInterval)

    setTimeout(() => {
      clearInterval(spinIntervalRef.current)

      const finalCategoryIndex = Math.floor(Math.random() * categories.length)
      const finalCategory = categories[finalCategoryIndex]

      setSelectedCategory(finalCategory)
      setSpinningIndex(finalCategoryIndex)

      // MUDANÇA: Chama a função que distribui a pergunta
      fetchQuestionAndDistribute(finalCategory.name)
    }, spinDuration)
  }

  // --- MUDANÇA 3: DISTRIBUIÇÃO DA PERGUNTA PARA O FIREBASE ---
  const fetchQuestionAndDistribute = async categoryName => {
    // Lógica para obter a pergunta (MANTIDA IGUAL DA ÚLTIMA RESPOSTA)
    const currentCategoryObj = categories.find(c => c.name === categoryName)
    const categoryId = currentCategoryObj ? currentCategoryObj.id : 'art'
    const categoryHistory = lastQuestions[categoryId] || []

    const systemPrompt = `
      **Seu Papel:** Você é um assistente de IA para um jogo de trivia chamado 'Questionados'.
      // ... (restante do systemPrompt) ...
      **Regras:**
      // ... (restante das regras) ...
      5. Evite repetir estas perguntas ou criar perguntas similares: ${categoryHistory.join(
        ', '
      )}.
      // ...
    `.trim()

    const MAX_RETRIES = 3

    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        const completion = await groqClient.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Gera uma pergunta sobre ${categoryName}.`
            }
          ],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.7,
          response_format: { type: 'json_object' }
        })

        const jsonText = completion.choices[0]?.message?.content

        if (!jsonText) throw new Error('Resposta vazia da API.')

        const parsedQuestion = JSON.parse(jsonText)

        if (
          !parsedQuestion.pergunta ||
          !parsedQuestion.alternativas ||
          !parsedQuestion.respostaCorreta
        ) {
          throw new Error('JSON inválido ou incompleto.')
        }

        // Atualiza histórico localmente
        if (lastQuestions[categoryId]) {
          lastQuestions[categoryId].push(parsedQuestion.pergunta)
          if (lastQuestions[categoryId].length > 20) {
            lastQuestions[categoryId].shift()
          }
        }

        // PASSO DE DISTRIBUIÇÃO
        if (gameId) {
          // Se estivermos em modo versus, distribuímos via Firebase
          const gameRef = doc(db, 'games', gameId)
          await updateDoc(gameRef, {
            currentQuestion: parsedQuestion,
            selectedCategory: categoryId,
            gameState: 'question',
            lastResult: null // Limpa o resultado anterior
          })
          // O estado local será atualizado pelo `onSnapshot`
        } else {
          // Se for modo solo, atualiza o estado local
          setCurrentQuestion(parsedQuestion)
          setGameState('question')
        }

        return // Sucesso
      } catch (err) {
        console.warn(`Tentativa ${i + 1} falhou:`, err)

        if (i === MAX_RETRIES - 1) {
          setError('Não foi possível gerar a pergunta. Tente novamente.')
          setGameState(gameId ? 'idle' : 'idle')
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }
  }

  // --- LÓGICA DE RESPOSTA (ADAPTADA) ---
  const handleAnswer = async answer => {
    if (gameState !== 'question' || !currentQuestion) return

    const isCorrect = answer === currentQuestion.respostaCorreta
    const categoryId = selectedCategory.id

    if (gameId) {
      // MODO VERSUS: Apenas atualiza a pontuação no Firebase
      const playerKey = isPlayerOne ? 'player1Score' : 'player2Score'
      const opponentKey = isPlayerOne ? 'player2Score' : 'player1Score'
      const newScore = isPlayerOne
        ? playerScores.player1 + (isCorrect ? 1 : 0)
        : playerScores.player2 + (isCorrect ? 1 : 0)

      const gameRef = doc(db, 'games', gameId)

      // O jogador atualiza sua pontuação imediatamente
      await updateDoc(gameRef, {
        [playerKey]: newScore,
        lastResult: isCorrect ? 'correct' : 'incorrect'
      })

      // O estado local será atualizado pelo `onSnapshot`
    } else {
      // MODO SOLO: Mantido como estava
      if (isCorrect) {
        setResult('correct')
        setScores(prevScores => ({
          ...prevScores,
          [categoryId]: prevScores[categoryId] + 1
        }))
      } else {
        setResult('incorrect')
      }
      setGameState('result')
    }
  }

  // --- COMPONENTES DE RENDERIZAÇÃO (ADAPTADOS) ---

  // 5.1. Renderiza o Placar (Adaptado para Versão Solo e Versus)
  const renderScoreboard = () => {
    // Se estiver em modo Versus e conectado, mostra o placar Versus
    if (gameId && opponentName) {
      const currentPlayerScore = isPlayerOne
        ? playerScores.player1
        : playerScores.player2
      const opponentScore = isPlayerOne
        ? playerScores.player2
        : playerScores.player1
      const currentPlayerName = playerName
      const isMyTurn = isHost ? gameState === 'idle' : gameState === 'waiting'

      return (
        <div className='w-full max-w-lg mx-auto bg-gray-700 p-4 rounded-lg shadow-xl'>
          <h2 className='text-2xl font-bold text-center text-white mb-4'>
            Sala: {gameId} ({isHost ? 'Host' : 'Convidado'})
          </h2>
          <div className='flex justify-between text-center'>
            <div
              className={`p-4 rounded-lg flex-1 mx-2 ${
                isPlayerOne ? 'bg-indigo-600' : 'bg-red-600'
              } shadow-md`}
            >
              <FontAwesomeIcon
                icon={faUser}
                className='w-5 h-5 text-white mb-1'
              />
              <p className='font-bold text-xl'>{currentPlayerName}</p>
              <p className='text-3xl font-extrabold'>{currentPlayerScore}</p>
            </div>
            <div
              className={`p-4 rounded-lg flex-1 mx-2 ${
                !isPlayerOne ? 'bg-indigo-600' : 'bg-red-600'
              } shadow-md`}
            >
              <FontAwesomeIcon
                icon={faUser}
                className='w-5 h-5 text-white mb-1'
              />
              <p className='font-bold text-xl'>
                {opponentName || 'Esperando...'}
              </p>
              <p className='text-3xl font-extrabold'>{opponentScore}</p>
            </div>
          </div>
          {gameState === 'waiting' && (
            <p className='text-center text-yellow-300 mt-2 font-medium'>
              Aguardando o Host iniciar a próxima rodada...
            </p>
          )}
          {gameState === 'question' && (
            <p className='text-center text-blue-300 mt-2 font-medium'>
              Responda o mais rápido possível!
            </p>
          )}
        </div>
      )
    }

    // Se estiver em modo Solo (Single Player)
    return (
      <div className='grid grid-cols-3 sm:grid-cols-6 gap-2 p-2 rounded-lg bg-gray-900/50 shadow-inner'>
        {categories.map((category, index) => {
          const isSelected =
            selectedCategory &&
            selectedCategory.id === category.id &&
            (gameState === 'question' || gameState === 'result')
          const isSpinning = gameState === 'spinning' && spinningIndex === index

          let highlightClass = 'scale-100 opacity-70'
          if (isSelected) {
            highlightClass = 'scale-110 opacity-100 shadow-lg shadow-white/30'
          } else if (isSpinning) {
            highlightClass =
              'scale-110 opacity-100 shadow-lg shadow-blue-400/50'
          }

          return (
            <div
              key={category.id}
              className={`flex flex-col items-center p-2 rounded-lg ${category.color} ${highlightClass} transition-all duration-150 transform-gpu`}
            >
              <FontAwesomeIcon
                icon={category.icon}
                className='w-6 h-6 sm:w-8 sm:h-8 text-white'
              />
              <span className='text-white font-semibold text-xs sm:text-sm mt-1'>
                {category.name}
              </span>
              <span className='text-white font-bold text-lg sm:text-2xl'>
                {scores[category.id]}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  // 5.2. Renderiza o Menu Versus
  const renderVersusMenu = () => (
    <div className='w-full max-w-lg p-6 bg-gray-800/80 backdrop-blur-sm rounded-lg shadow-lg'>
      <h3 className='text-2xl font-bold text-white mb-4 text-center'>
        Modo Versus (Online)
      </h3>

      {error && <p className='text-red-400 mb-4 text-center'>{error}</p>}

      <input
        type='text'
        placeholder='Seu Nome de Jogador'
        value={playerName}
        onChange={e => setPlayerName(e.target.value)}
        className='w-full p-3 mb-3 rounded-lg text-gray-900 placeholder-gray-500'
      />

      <div className='flex space-x-4 mb-6'>
        <button
          onClick={createGame}
          className='flex-1 p-3 bg-green-600 text-white rounded-lg font-bold
                     hover:bg-green-700 active:scale-95 transition-transform'
        >
          Criar Sala (Host)
        </button>
        <div className='w-px bg-gray-600'></div>
        <input
          type='text'
          placeholder='ID da Sala'
          value={gameId}
          onChange={e => setGameId(e.target.value.toUpperCase())}
          className='flex-1 p-3 rounded-lg text-gray-900 placeholder-gray-500 text-center uppercase'
          maxLength={6}
        />
        <button
          onClick={joinGame}
          className='flex-1 p-3 bg-blue-600 text-white rounded-lg font-bold
                     hover:bg-blue-700 active:scale-95 transition-transform'
        >
          Entrar
        </button>
      </div>

      <button
        onClick={() => setGameState('idle')}
        className='w-full p-3 bg-gray-600 text-white rounded-lg font-bold
                   hover:bg-gray-700 transition-colors mt-4'
      >
        Voltar (Modo Solo)
      </button>
    </div>
  )

  // 5.3. Renderiza a Tela de Espera (Waiting)
  const renderWaitingScreen = () => (
    <div className='w-full max-w-lg p-6 bg-gray-800/80 rounded-lg shadow-lg text-center h-48 flex flex-col justify-center items-center'>
      <h3 className='text-2xl font-bold text-white mb-2'>
        Aguardando Oponente...
      </h3>
      <p className='text-xl text-yellow-400 font-mono mb-4'>ID: {gameId}</p>
      {opponentName && (
        <p className='text-lg text-green-400'>
          Oponente encontrado: {opponentName}!
        </p>
      )}
      <p className='text-sm text-gray-400'>
        Compartilhe o ID da sala para começar.
      </p>

      {/* Botão para Host Iniciar */}
      {isHost && opponentName && (
        <button
          onClick={spinWheel}
          className='w-full p-3 mt-4 bg-green-600 text-white rounded-lg font-bold
                       text-lg hover:scale-105 active:scale-100 transition-transform shadow-md'
        >
          INICIAR JOGO!
        </button>
      )}

      {/* Botão para qualquer um voltar */}
      <button
        onClick={resetGame}
        className='w-full p-3 mt-4 bg-red-600 text-white rounded-lg font-bold
                   text-lg hover:bg-red-700 active:scale-100 transition-transform shadow-md'
      >
        Sair da Sala
      </button>
    </div>
  )

  // 5.4. Renderiza a Tela de Resultados Versus (Sincronizada)
  const renderVersusResult = () => {
    let message = ''
    let bgClass = 'bg-gray-600/90'

    if (lastSyncedResult) {
      if (lastSyncedResult === 'correct') {
        message = 'Você Acertou!'
        bgClass = 'bg-green-600/90'
      } else if (lastSyncedResult === 'incorrect') {
        message = 'Você Errou!'
        bgClass = 'bg-red-700/90'
      } else {
        message = lastSyncedResult // Exibe o resultado do oponente se for um nome
      }
    } else {
      message = 'Aguardando o Host para a próxima rodada...'
    }

    return (
      <div
        className={`w-full max-w-lg p-6 ${bgClass} backdrop-blur-sm rounded-lg shadow-lg text-center`}
      >
        <h3 className='text-3xl font-extrabold text-white mb-3'>{message}</h3>

        {isHost ? (
          <button
            onClick={spinWheel}
            className='w-full p-3 bg-white text-gray-800 rounded-lg font-bold
                       text-lg hover:scale-105 active:scale-100 transition-transform shadow-md'
          >
            Próxima Rodada (Girar)!
          </button>
        ) : (
          <p className='text-white mt-4'>
            Aguarde o Host ({opponentName}) iniciar a próxima pergunta.
          </p>
        )}

        <button
          onClick={resetGame}
          className='w-full p-3 mt-4 bg-red-600 text-white rounded-lg font-bold
                       text-lg hover:bg-red-700 active:scale-100 transition-transform shadow-md'
        >
          Sair da Sala
        </button>
      </div>
    )
  }

  // 5.5. Renderiza a Área Central
  const renderCentralArea = () => {
    if (error) {
      // ... (código de erro mantido) ...
      return (
        <div className='w-full max-w-lg p-6 bg-red-800/80 rounded-lg shadow-lg text-center h-auto flex flex-col justify-center'>
          <h3 className='text-xl font-bold text-white mb-2'>Erro</h3>
          <p className='text-red-100'>{error}</p>
          <button
            onClick={() => {
              setError(null)
              setGameState(gameId ? 'idle' : 'versus-menu')
            }}
            className='w-full p-3 mt-4 bg-white text-gray-800 rounded-lg font-bold
                     text-lg hover:scale-105 active:scale-100 transition-transform shadow-md'
          >
            Voltar
          </button>
        </div>
      )
    }

    if (gameState === 'versus-menu') {
      return renderVersusMenu()
    }

    if (gameState === 'waiting') {
      return renderWaitingScreen()
    }

    if (gameState === 'question' && currentQuestion) {
      // ... (código de pergunta mantido) ...
      return (
        <div className='w-full max-w-lg p-6 bg-gray-800/80 backdrop-blur-sm rounded-lg shadow-lg'>
          <h3 className='text-xl font-bold text-white mb-4 text-center'>
            {currentQuestion.pergunta}
          </h3>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            {currentQuestion.alternativas.map((alt, index) => (
              <button
                key={index}
                onClick={() => handleAnswer(alt)}
                className='p-4 bg-blue-600 text-white rounded-lg font-semibold
                           hover:bg-blue-500 active:scale-95 transition-all shadow-md'
              >
                {alt}
              </button>
            ))}
          </div>
        </div>
      )
    }

    if (gameState === 'result') {
      if (gameId) {
        return renderVersusResult()
      }

      const isCorrect = result === 'correct'
      // ... (código de resultado solo mantido) ...
      return (
        <div
          className={`w-full max-w-lg p-6 ${
            isCorrect ? 'bg-green-600/90' : 'bg-red-700/90'
          } backdrop-blur-sm rounded-lg shadow-lg text-center`}
        >
          <h3 className='text-3xl font-extrabold text-white mb-3'>
            {isCorrect ? 'Correto!' : 'Incorreto!'}
          </h3>
          {!isCorrect && currentQuestion && (
            <p className='text-white text-lg mb-4'>
              A resposta era:{' '}
              <strong className='font-bold'>
                {currentQuestion.respostaCorreta}
              </strong>
            </p>
          )}
          <button
            onClick={spinWheel}
            className='w-full p-3 bg-white text-gray-800 rounded-lg font-bold
                       text-lg hover:scale-105 active:scale-100 transition-transform shadow-md'
          >
            Questionar Novamente!
          </button>
        </div>
      )
    }

    if (gameState === 'spinning') {
      // ... (código de spinning mantido) ...
      return (
        <div className='w-full max-w-lg p-6 text-center h-48 flex flex-col items-center justify-center'>
          <svg
            className='animate-spin h-10 w-10 text-white'
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
          >
            <circle
              className='opacity-25'
              cx='12'
              cy='12'
              r='10'
              stroke='currentColor'
              strokeWidth='4'
            ></circle>
            <path
              className='opacity-75'
              fill='currentColor'
              d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
            ></path>
          </svg>
          <h3 className='text-2xl font-bold text-white animate-pulse mt-4'>
            Gerando questão com IA...
          </h3>
        </div>
      )
    }

    if (gameState === 'idle') {
      return (
        <div className='w-full max-w-lg p-6 text-center h-48 flex flex-col items-center justify-center'>
          {/* Se estiver no modo versus (offline, mas conectado a uma sala) */}
          {gameId ? (
            <button
              onClick={spinWheel}
              disabled={!groqClient || !isHost}
              className='w-56 h-56 bg-white text-gray-800 rounded-full
                         text-xl font-bold shadow-xl
                         hover:scale-105 active:scale-95 transition-transform
                         disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
            >
              {isHost
                ? 'GIRAR ROLETA!'
                : `Aguardando ${opponentName || 'Host'}`}
            </button>
          ) : (
            <>
              <button
                onClick={spinWheel}
                disabled={!groqClient}
                className='w-48 h-48 bg-white text-gray-800 rounded-full
                            text-2xl font-bold shadow-xl mb-4
                            hover:scale-105 active:scale-95 transition-transform
                            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
              >
                JOGAR SOLO
              </button>
              <button
                onClick={() => setGameState('versus-menu')}
                className='w-48 p-3 bg-pink-500 text-white rounded-lg font-bold
                            hover:bg-pink-600 active:scale-95 transition-transform shadow-md flex items-center justify-center'
              >
                <FontAwesomeIcon icon={faUserGroup} className='w-4 h-4 mr-2' />
                Modo Versus
              </button>
            </>
          )}
        </div>
      )
    }

    return null
  }

  // --- Renderização Principal do App ---
  return (
    <div
      className='flex flex-col items-center justify-between min-h-screen w-full
                   bg-gradient-to-b from-gray-800 to-gray-900 text-white p-4 font-sans'
    >
      <header className='w-full max-w-2xl mb-4'>
        <h1
          className='text-4xl font-extrabold text-center mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-pink-500'
          style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}
        >
          Questionados
        </h1>
        {renderScoreboard()}
      </header>

      <main className='flex flex-col items-center justify-center flex-grow w-full my-8'>
        {renderCentralArea()}
      </main>

      <footer className='w-full text-center p-4 text-gray-500 text-sm'>
        Criado para fins educacionais. Powered by Groq.
      </footer>
    </div>
  )
}
