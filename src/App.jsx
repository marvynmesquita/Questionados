import React, { useState, useRef, useEffect, useMemo } from 'react'
import Groq from 'groq-sdk'
import { db, doc, getDoc, setDoc, onSnapshot, updateDoc } from './firebase'
import { customAlphabet } from 'nanoid'

// Ícones
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPalette,
  faFlask,
  faFutbol,
  faGlobe,
  faTicket,
  faLandmark,
  faUserGroup,
  faBrain,
  faTrophy,
  faTimesCircle,
  faCheckCircle,
  faLightbulb
} from '@fortawesome/free-solid-svg-icons'

const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6)

// Categorias
const categories = [
  {
    id: 'art',
    name: 'Arte',
    color: 'bg-red-500',
    textColor: 'text-red-500',
    icon: faPalette
  },
  {
    id: 'science',
    name: 'Ciência',
    color: 'bg-green-500',
    textColor: 'text-green-500',
    icon: faFlask
  },
  {
    id: 'sports',
    name: 'Esporte',
    color: 'bg-blue-500',
    textColor: 'text-blue-500',
    icon: faFutbol
  },
  {
    id: 'geography',
    name: 'Geografia',
    color: 'bg-yellow-500',
    textColor: 'text-yellow-600',
    icon: faGlobe
  },
  {
    id: 'entertainment',
    name: 'Entretenim.', // Abreviação para mobile
    color: 'bg-pink-500',
    textColor: 'text-pink-500',
    icon: faTicket
  },
  {
    id: 'history',
    name: 'História',
    color: 'bg-purple-500',
    textColor: 'text-purple-500',
    icon: faLandmark
  }
]

export default function App () {
  // --- ESTADOS (HOOKS) DEVEM FICAR AQUI DENTRO ---
  const [playerName, setPlayerName] = useState('')
  const [gameId, setGameId] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [error, setError] = useState(null)

  const [gameData, setGameData] = useState(null)

  const [spinningIndex, setSpinningIndex] = useState(0)
  const [localGameState, setLocalGameState] = useState('versus-menu')
  const [localQuestion, setLocalQuestion] = useState(null)
  const [localResult, setLocalResult] = useState(null)

  const [soloScores, setSoloScores] = useState({
    art: 0,
    science: 0,
    sports: 0,
    geography: 0,
    entertainment: 0,
    history: 0
  })

  // Novo estado para o histórico de perguntas (para evitar repetição)
  const [questionHistory, setQuestionHistory] = useState({
    art: [],
    science: [],
    sports: [],
    geography: [],
    entertainment: [],
    history: []
  })

  const spinIntervalRef = useRef(null)

  const rawApiKey = process.env.REACT_APP_GROQ_API_KEY
  const [apiKey, setApiKey] = useState(undefined)

  useEffect(() => {
    if (!rawApiKey || rawApiKey === 'undefined') {
      setApiKey(null)
    } else {
      setApiKey(rawApiKey)
    }
  }, [rawApiKey])

  const groqClient = useMemo(() => {
    if (apiKey) {
      return new Groq({ apiKey: apiKey, dangerouslyAllowBrowser: true })
    }
    return null
  }, [apiKey])

  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current)
    }
  }, [])

  // Sync Firebase
  useEffect(() => {
    if (!gameId) return

    const cleanGameId = gameId.trim().toUpperCase()
    const gameRef = doc(db, 'games', cleanGameId)

    const unsubscribe = onSnapshot(
      gameRef,
      docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data()
          setGameData(data)

          if (data.currentQuestion && data.gameState === 'question') {
            if (
              data.currentQuestion.pergunta !== localQuestion?.pergunta ||
              localGameState !== 'question'
            ) {
              if (spinIntervalRef.current)
                clearInterval(spinIntervalRef.current)
              setLocalQuestion(data.currentQuestion)
              setLocalGameState('question')
              setLocalResult(null)
            }
          } else if (data.lastResult && data.gameState === 'idle') {
            if (localGameState !== 'result') {
              setLocalResult(data.lastResult)
              setLocalGameState('result')
            }
          } else if (data.gameState === 'spinning') {
            if (localGameState !== 'spinning') {
              setLocalGameState('spinning')
              if (!isHost) spinWheel(false)
            }
          } else if (data.gameState !== localGameState) {
            if (localGameState !== 'versus-menu') {
              setLocalGameState(data.gameState)
            }
          }
        } else {
          if (localGameState !== 'versus-menu') {
            alert('A sala foi encerrada.')
            resetGame()
          }
        }
      },
      error => console.error('Erro no listener:', error)
    )

    return () => unsubscribe()
  }, [gameId, localGameState, localQuestion, isHost])

  const createGame = async () => {
    if (!playerName) return setError('Digite seu nome')
    setError(null)
    const newId = nanoid()
    try {
      await setDoc(doc(db, 'games', newId), {
        player1Name: playerName,
        player1Score: 0,
        player2Name: null,
        player2Score: 0,
        gameState: 'waiting',
        currentQuestion: null,
        selectedCategory: null,
        lastResult: null,
        createdAt: new Date().toISOString()
      })
      setGameId(newId)
      setIsHost(true)
      setLocalGameState('waiting')
    } catch (e) {
      console.error(e)
      setError('Erro ao criar sala.')
    }
  }

  const joinGame = async () => {
    if (!playerName || !gameId) return setError('Preencha nome e código')
    setError(null)
    const cleanId = gameId.trim().toUpperCase()
    const gameRef = doc(db, 'games', cleanId)
    try {
      const snap = await getDoc(gameRef)
      if (snap.exists()) {
        const data = snap.data()
        if (!data.player2Name) {
          await updateDoc(gameRef, { player2Name: playerName })
          setIsHost(false)
          setLocalGameState('waiting')
        } else {
          setError('Sala cheia.')
        }
      } else {
        setError('Sala não encontrada.')
      }
    } catch (e) {
      console.error(e)
      setError('Erro ao entrar.')
    }
  }

  const resetGame = () => {
    setGameId('')
    setGameData(null)
    setPlayerName('')
    setIsHost(false)
    setLocalGameState('versus-menu')
    setLocalQuestion(null)
    setLocalResult(null)
    setError(null)
    // Limpa histórico ao resetar
    setQuestionHistory({
      art: [],
      science: [],
      sports: [],
      geography: [],
      entertainment: [],
      history: []
    })
  }

  const startRound = async () => {
    if (!isHost) return
    await updateDoc(doc(db, 'games', gameId), {
      gameState: 'spinning',
      lastResult: null
    })
    spinWheel(true)
  }

  const spinWheel = async (shouldGenerate = true) => {
    setLocalGameState('spinning')
    setLocalResult(null)
    setLocalQuestion(null)

    let currentSpin = 0
    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current)

    spinIntervalRef.current = setInterval(() => {
      setSpinningIndex(prev => (prev + 1) % categories.length)
      currentSpin++
    }, 80)

    setTimeout(async () => {
      clearInterval(spinIntervalRef.current)
      const finalIndex = Math.floor(Math.random() * categories.length)
      setSpinningIndex(finalIndex)
      const category = categories[finalIndex]

      if (shouldGenerate) {
        if (!gameId || isHost) {
          await generateQuestion(category)
        }
      }
    }, 2500)
  }

  const generateQuestion = async category => {
    if (!groqClient) return

    // Pega o histórico desta categoria
    const previousQuestions = questionHistory[category.id] || []

    // Se houver histórico, pede para não repetir
    const avoidContext =
      previousQuestions.length > 0
        ? `IMPORTANTE: NÃO repita nenhuma destas perguntas já feitas: [${previousQuestions.join(
            '; '
          )}].`
        : ''

    const prompt = `Atue como um apresentador de Game Show inteligente. Gere uma pergunta de nível médio/difícil sobre a categoria: ${category.name}.
    ${avoidContext}
    Responda APENAS um JSON neste formato exato, sem markdown: 
    {"pergunta": "Texto da pergunta", "alternativas": ["Opção A", "Opção B", "Opção C", "Opção D"], "respostaCorreta": "Texto exato da opção correta", "categoria": "${category.id}"}.
    Idioma: Português do Brasil.
    Não traduza a categoria.`

    try {
      const completion = await groqClient.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        temperature: 0.7
      })

      const content = JSON.parse(completion.choices[0]?.message?.content)

      // Salva a pergunta no histórico local para não repetir
      setQuestionHistory(prev => ({
        ...prev,
        [category.id]: [...prev[category.id], content.pergunta]
      }))

      if (gameId) {
        await updateDoc(doc(db, 'games', gameId), {
          currentQuestion: content,
          selectedCategory: category.id,
          gameState: 'question'
        })
      } else {
        setLocalQuestion(content)
        setLocalGameState('question')
      }
    } catch (e) {
      console.error(e)
      setError('A IA demorou para responder. Tente novamente.')
      if (gameId)
        await updateDoc(doc(db, 'games', gameId), { gameState: 'idle' })
      else setLocalGameState('idle')
    }
  }

  const handleAnswer = async answer => {
    if (!localQuestion) return
    const isCorrect = answer === localQuestion.respostaCorreta

    if (gameId) {
      const myScoreField = isHost ? 'player1Score' : 'player2Score'
      const currentScore = (gameData && gameData[myScoreField]) || 0
      try {
        await updateDoc(doc(db, 'games', gameId), {
          [myScoreField]: currentScore + (isCorrect ? 1 : 0),
          lastResult: isCorrect ? 'correct' : 'incorrect',
          gameState: 'idle'
        })
      } catch (e) {
        console.error('Erro ao enviar resposta:', e)
      }
    } else {
      if (isCorrect) {
        setLocalResult('correct')
        setSoloScores(prev => ({
          ...prev,
          [categories[spinningIndex].id]: prev[categories[spinningIndex].id] + 1
        }))
      } else {
        setLocalResult('incorrect')
      }
      setLocalGameState('result')
    }
  }

  // --- RENDERERS ---

  const renderCategoryCard = (cat, isSelected = false) => (
    <div
      key={cat.id}
      className={`
        flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl transition-all duration-300 shadow-lg aspect-square
        ${
          isSelected
            ? `${cat.color} scale-105 sm:scale-110 ring-4 ring-white z-10`
            : 'bg-gray-800 opacity-60 scale-95'
        }
      `}
    >
      <div className='bg-white/20 p-2 sm:p-3 rounded-full mb-2'>
        <FontAwesomeIcon
          icon={cat.icon}
          className='text-white text-xl sm:text-2xl'
        />
      </div>
      <span className='text-white font-bold text-xs sm:text-sm uppercase tracking-wider text-center'>
        {cat.name}
      </span>
      {/* Mostra score apenas se não estiver girando a roleta principal */}
      {localGameState !== 'spinning' && !gameId && (
        <span className='text-[10px] sm:text-xs font-mono mt-1 text-white/80'>
          Lvl {soloScores[cat.id]}
        </span>
      )}
    </div>
  )

  return (
    <div className='h-screen w-full bg-gray-900 text-white font-sans flex flex-col overflow-hidden'>
      {/* HEADER FIXO */}
      <header className='flex-shrink-0 w-full p-4 sm:p-6 flex flex-col items-center bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 shadow-md z-20'>
        <div className='flex items-center gap-3'>
          <FontAwesomeIcon
            icon={faBrain}
            className='text-3xl sm:text-4xl text-blue-500'
          />
          <h1 className='text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-pink-500 tracking-tight'>
            QUESTIONADOS
          </h1>
        </div>
        {gameId && (
          <div className='mt-2 px-3 py-1 bg-gray-700 rounded-full text-[10px] sm:text-xs font-mono text-gray-300'>
            SALA: <span className='text-white font-bold'>{gameId}</span>
          </div>
        )}
      </header>

      {/* ÁREA DE CONTEÚDO COM SCROLL INTERNO */}
      <main className='flex-1 w-full overflow-y-auto overflow-x-hidden relative z-10'>
        <div className='min-h-full flex flex-col items-center justify-center py-6 px-4'>
          {/* ERROR TOAST */}
          {error && (
            <div className='fixed top-24 z-50 animate-bounce bg-red-500 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-full shadow-xl border-2 border-red-600 font-bold flex items-center gap-3 text-sm sm:text-base'>
              <FontAwesomeIcon icon={faTimesCircle} />
              {error}
              <button
                onClick={() => setError(null)}
                className='ml-4 underline text-xs'
              >
                Fechar
              </button>
            </div>
          )}

          {/* PLACAR VERSUS */}
          {gameId && gameData && (
            <div className='w-full max-w-xl grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 mb-8'>
              <div
                className={`p-3 sm:p-4 rounded-2xl border-2 ${
                  isHost
                    ? 'bg-blue-600/20 border-blue-500'
                    : 'bg-gray-800 border-gray-700'
                } text-center transition-all`}
              >
                <div className='text-xs sm:text-sm text-gray-400 uppercase font-bold mb-1 truncate'>
                  {gameData.player1Name}
                </div>
                <div className='text-2xl sm:text-4xl font-black text-white'>
                  {gameData.player1Score}
                </div>
              </div>

              <div className='text-xl sm:text-2xl font-black text-gray-600 italic'>
                VS
              </div>

              <div
                className={`p-3 sm:p-4 rounded-2xl border-2 ${
                  !isHost && gameData.player2Name
                    ? 'bg-red-600/20 border-red-500'
                    : 'bg-gray-800 border-gray-700'
                } text-center transition-all`}
              >
                <div className='text-xs sm:text-sm text-gray-400 uppercase font-bold mb-1 truncate'>
                  {gameData.player2Name || '...'}
                </div>
                <div className='text-2xl sm:text-4xl font-black text-white'>
                  {gameData.player2Score}
                </div>
              </div>
            </div>
          )}

          {/* MENU */}
          {localGameState === 'versus-menu' && (
            <div className='w-full max-w-md bg-gray-800 p-6 sm:p-8 rounded-3xl shadow-2xl border border-gray-700 text-center'>
              <h2 className='text-xl sm:text-2xl font-bold mb-6 text-blue-400'>
                Modo Versus
              </h2>

              <div className='space-y-4'>
                <input
                  className='w-full bg-gray-900/50 border border-gray-600 p-3 sm:p-4 rounded-xl text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all text-center font-bold text-base sm:text-lg'
                  placeholder='Seu Apelido'
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                />

                <button
                  onClick={createGame}
                  className='w-full py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl font-bold text-base sm:text-lg shadow-lg hover:scale-[1.02] transition-transform'
                >
                  Criar Nova Sala
                </button>

                <div className='relative py-2'>
                  <div className='absolute inset-0 flex items-center'>
                    <div className='w-full border-t border-gray-700'></div>
                  </div>
                  <div className='relative flex justify-center'>
                    <span className='bg-gray-800 px-4 text-xs sm:text-sm text-gray-500'>
                      OU ENTRE EM UMA
                    </span>
                  </div>
                </div>

                <div className='flex gap-2'>
                  <input
                    className='flex-1 bg-gray-900/50 border border-gray-600 p-3 sm:p-4 rounded-xl text-white text-center uppercase font-mono text-base sm:text-lg tracking-widest outline-none focus:border-green-500'
                    placeholder='CÓDIGO'
                    maxLength={6}
                    value={gameId}
                    onChange={e => setGameId(e.target.value.toUpperCase())}
                  />
                  <button
                    onClick={joinGame}
                    className='px-4 sm:px-6 bg-green-600 rounded-xl font-bold hover:bg-green-500 transition-colors text-sm sm:text-base'
                  >
                    Entrar
                  </button>
                </div>

                <button
                  onClick={() => setLocalGameState('idle')}
                  className='text-xs sm:text-sm text-gray-500 hover:text-white mt-4 underline'
                >
                  Jogar Modo Solo (Offline)
                </button>
              </div>
            </div>
          )}

          {/* WAITING */}
          {localGameState === 'waiting' && (
            <div className='text-center w-full max-w-md animate-fade-in'>
              <div className='inline-block p-4 sm:p-6 bg-gray-800 rounded-full mb-6 animate-pulse'>
                <FontAwesomeIcon
                  icon={faUserGroup}
                  className='text-3xl sm:text-5xl text-blue-400'
                />
              </div>
              <h2 className='text-2xl sm:text-3xl font-bold mb-2'>
                Aguardando Jogadores
              </h2>
              <p className='text-gray-400 mb-6 text-sm sm:text-base'>
                Compartilhe o código:
              </p>

              <div className='bg-gray-800 border-2 border-dashed border-gray-600 rounded-xl p-4 sm:p-6 mb-8 inline-block w-full'>
                <span
                  className='text-3xl sm:text-4xl font-mono font-black tracking-[0.2em] text-white select-all cursor-pointer block'
                  onClick={() => navigator.clipboard.writeText(gameId)}
                >
                  {gameId}
                </span>
              </div>

              {isHost && gameData?.player2Name && (
                <button
                  onClick={startRound}
                  className='block w-full bg-green-500 hover:bg-green-400 text-white py-3 sm:py-4 rounded-xl font-black text-lg sm:text-xl shadow-lg hover:-translate-y-1 transition-all animate-bounce'
                >
                  COMEÇAR PARTIDA
                </button>
              )}

              {!isHost && (
                <p className='text-yellow-500 font-medium animate-pulse text-sm sm:text-base'>
                  {gameData?.player2Name
                    ? 'Aguardando o Host iniciar...'
                    : 'Entrando na sala...'}
                </p>
              )}

              <button
                onClick={resetGame}
                className='mt-8 sm:mt-12 text-gray-500 hover:text-red-400 text-sm'
              >
                Cancelar
              </button>
            </div>
          )}

          {/* SPINNING */}
          {localGameState === 'spinning' && (
            <div className='w-full flex flex-col items-center'>
              <div className='grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-8 sm:mb-10 w-full max-w-lg'>
                {categories.map((cat, i) =>
                  renderCategoryCard(cat, spinningIndex === i)
                )}
              </div>

              <div className='bg-gray-800 px-6 py-4 sm:px-8 sm:py-6 rounded-2xl border border-gray-700 shadow-2xl text-center max-w-lg animate-pulse w-full'>
                <h3 className='text-lg sm:text-xl font-bold text-white mb-2'>
                  Sorteando Categoria...
                </h3>
                <p className='text-blue-400 font-medium text-sm sm:text-base'>
                  A Inteligência Artificial está criando um desafio exclusivo
                  para você...
                </p>
              </div>
            </div>
          )}

          {/* QUESTION */}
          {localGameState === 'question' && localQuestion && (
            <div className='w-full max-w-2xl animate-slide-up'>
              <div className='flex justify-center -mb-5 sm:-mb-6 relative z-10'>
                <div
                  className={`${
                    categories.find(
                      c => c.id === (localQuestion.categoria || 'art')
                    )?.color || 'bg-gray-500'
                  } px-6 py-2 sm:px-8 sm:py-3 rounded-full shadow-lg flex items-center gap-2 sm:gap-3`}
                >
                  <FontAwesomeIcon
                    icon={
                      categories.find(
                        c => c.id === (localQuestion.categoria || 'art')
                      )?.icon
                    }
                    className='text-sm sm:text-base'
                  />
                  <span className='font-black uppercase tracking-wider text-xs sm:text-sm'>
                    {
                      categories.find(
                        c => c.id === (localQuestion.categoria || 'art')
                      )?.name
                    }
                  </span>
                </div>
              </div>

              <div className='bg-gray-800 pt-8 pb-6 px-4 sm:pt-10 sm:pb-8 sm:px-8 rounded-3xl shadow-2xl border border-gray-700'>
                <h3 className='text-lg sm:text-2xl font-bold text-center mb-6 sm:mb-8 leading-relaxed text-gray-100'>
                  {localQuestion.pergunta}
                </h3>

                <div className='grid grid-cols-1 gap-3'>
                  {localQuestion.alternativas.map((alt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(alt)}
                      className='group relative overflow-hidden bg-gray-700 hover:bg-blue-600 border border-gray-600 hover:border-blue-400 p-4 sm:p-5 rounded-xl text-left transition-all duration-200'
                    >
                      <span className='relative z-10 font-medium text-base sm:text-lg group-hover:text-white'>
                        {alt}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* RESULT */}
          {localGameState === 'result' && (
            <div className='text-center animate-scale-in w-full max-w-lg px-2 sm:px-4'>
              <div className='mb-4 sm:mb-6'>
                {localResult === 'correct' ? (
                  <FontAwesomeIcon
                    icon={faCheckCircle}
                    className='text-6xl sm:text-8xl text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]'
                  />
                ) : (
                  <FontAwesomeIcon
                    icon={faTimesCircle}
                    className='text-6xl sm:text-8xl text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                  />
                )}
              </div>

              <h2 className='text-3xl sm:text-4xl font-black mb-2'>
                {localResult === 'correct' ? 'RESPOSTA CORRETA!' : 'QUE PENA!'}
              </h2>

              {localResult === 'correct' ? (
                <p className='text-gray-400 mb-8 text-base sm:text-lg'>
                  +1 Ponto adicionado
                </p>
              ) : (
                <div className='mb-8 w-full'>
                  <p className='text-gray-400 mb-4 text-sm sm:text-base'>
                    Você errou...
                  </p>
                  {localQuestion && (
                    <div className='bg-gray-800/80 border border-green-500/30 p-4 rounded-xl animate-pulse w-full'>
                      <div className='flex items-center justify-center gap-2 text-green-400 mb-2'>
                        <FontAwesomeIcon icon={faLightbulb} />
                        <span className='text-xs font-bold uppercase tracking-widest'>
                          A resposta correta era:
                        </span>
                      </div>
                      <p className='text-white font-black text-lg sm:text-xl'>
                        {localQuestion.respostaCorreta}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* GRADE DE PONTUAÇÃO ADICIONADA NO MODO SOLO */}
              {!gameId && (
                <div className='grid grid-cols-3 gap-2 sm:gap-3 mb-8 w-full'>
                  {categories.map(cat => (
                    <div
                      key={cat.id}
                      className={`p-2 sm:p-3 rounded-xl border flex flex-col items-center transition-all ${
                        localQuestion && localQuestion.categoria === cat.id
                          ? 'bg-gray-700 border-gray-500 ring-1 ring-gray-400 scale-105 shadow-lg'
                          : 'bg-gray-800/50 border-gray-700 opacity-80'
                      }`}
                    >
                      <FontAwesomeIcon
                        icon={cat.icon}
                        className={`${cat.textColor} text-lg mb-1`}
                      />
                      <span className='text-[10px] text-gray-400 uppercase'>
                        {cat.name}
                      </span>
                      <span className='text-base font-bold text-white'>
                        {soloScores[cat.id]}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {gameId ? (
                isHost ? (
                  <button
                    onClick={startRound}
                    className='w-full sm:w-auto px-8 py-3 sm:py-4 bg-white text-gray-900 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl'
                  >
                    Próxima Rodada{' '}
                    <FontAwesomeIcon icon={faTrophy} className='ml-2' />
                  </button>
                ) : (
                  <div className='flex flex-col items-center gap-3 bg-gray-800/50 p-4 rounded-xl'>
                    <div className='w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin'></div>
                    <p className='text-sm text-gray-400'>
                      Aguardando o Host iniciar a próxima...
                    </p>
                  </div>
                )
              ) : (
                <button
                  onClick={() => spinWheel(true)}
                  className='w-full sm:w-auto px-8 py-3 sm:py-4 bg-white text-gray-900 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl'
                >
                  Continuar Jogando
                </button>
              )}
            </div>
          )}

          {/* IDLE SOLO */}
          {localGameState === 'idle' && !gameId && (
            <div className='flex flex-col items-center w-full'>
              <div className='grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-10 sm:mb-12 w-full max-w-lg'>
                {categories.map(cat => (
                  <div
                    key={cat.id}
                    className='bg-gray-800/50 p-3 sm:p-4 rounded-xl border border-gray-700 flex flex-col items-center'
                  >
                    <FontAwesomeIcon
                      icon={cat.icon}
                      className={`${cat.textColor} text-xl sm:text-2xl mb-1 sm:mb-2`}
                    />
                    <span className='text-[10px] sm:text-xs text-gray-400 uppercase'>
                      {cat.name}
                    </span>
                    <span className='text-lg sm:text-xl font-bold'>
                      {soloScores[cat.id]}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => spinWheel(true)}
                className='w-full max-w-xs bg-gradient-to-r from-pink-500 to-orange-500 py-4 sm:py-5 rounded-2xl font-black text-xl sm:text-2xl shadow-2xl hover:scale-105 transition-transform'
              >
                GIRAR ROLETA
              </button>

              <button
                onClick={() => setLocalGameState('versus-menu')}
                className='mt-8 text-sm text-gray-500 hover:text-white transition-colors'
              >
                Voltar ao Menu Principal
              </button>
            </div>
          )}
        </div>
      </main>

      {/* FOOTER FIXO */}
      <footer className='flex-shrink-0 w-full py-4 text-center text-gray-600 text-xs sm:text-sm border-t border-gray-800 bg-gray-900 z-20'>
        <p>Questionados Remake • Powered by Groq AI</p>
      </footer>

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes scale-in { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
        .animate-slide-up { animation: slide-up 0.5s ease-out; }
        .animate-scale-in { animation: scale-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        /* Ocultar scrollbar mas manter funcionalidade */
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}
