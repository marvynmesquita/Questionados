import React, { useState, useRef, useEffect, useMemo } from 'react'
import Groq from 'groq-sdk'
import { db, doc, getDoc, setDoc, onSnapshot, updateDoc, increment } from './firebase'
import { customAlphabet } from 'nanoid'

// Ícones
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faRobot,
  faLanguage,
  faKeyboard,
  faGuitar,
  faPersonDress,
  faHeadphones,
  faUserNinja,
  faDumbbell,
  faUserGroup,
  faBrain,
  faTrophy,
  faTimesCircle,
  faCheckCircle,
  faLightbulb,
  faChalkboardTeacher,
  faUserGraduate
} from '@fortawesome/free-solid-svg-icons'

const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6)

// Categorias
const categories = [
  { id: 'robotica', name: 'Robótica', color: 'bg-blue-500', textColor: 'text-blue-500', icon: faRobot },
  { id: 'ingles', name: 'Inglês', color: 'bg-red-500', textColor: 'text-red-500', icon: faLanguage },
  { id: 'teclado', name: 'Teclado', color: 'bg-purple-500', textColor: 'text-purple-500', icon: faKeyboard },
  { id: 'violao', name: 'Violão', color: 'bg-yellow-500', textColor: 'text-yellow-600', icon: faGuitar },
  { id: 'bale', name: 'Balé', color: 'bg-pink-400', textColor: 'text-pink-400', icon: faPersonDress },
  { id: 'hiphop', name: 'Dança Hip-Hop', color: 'bg-orange-500', textColor: 'text-orange-500', icon: faHeadphones },
  { id: 'carate', name: 'Caratê', color: 'bg-gray-100', textColor: 'text-gray-100', icon: faUserNinja },
  { id: 'jiujitsu', name: 'Jiu-Jitsu', color: 'bg-green-600', textColor: 'text-green-600', icon: faDumbbell }
]

export default function App () {
  const [playerName, setPlayerName] = useState('')
  const [gameId, setGameId] = useState('')
  const [role, setRole] = useState(null) // 'teacher', 'student', or null
  const [playerId] = useState(() => nanoid())
  const [error, setError] = useState(null)

  const [gameData, setGameData] = useState(null)

  const [spinningIndex, setSpinningIndex] = useState(0)
  const [localGameState, setLocalGameState] = useState('menu') // 'menu', 'waiting', 'spinning', 'question', 'answered', 'result', 'idle'
  const [localQuestion, setLocalQuestion] = useState(null)
  const [localResult, setLocalResult] = useState(null)

  const [soloScores, setSoloScores] = useState({
    robotica: 0, ingles: 0, teclado: 0, violao: 0, bale: 0, hiphop: 0, carate: 0, jiujitsu: 0
  })

  const [questionHistory, setQuestionHistory] = useState({
    robotica: [], ingles: [], teclado: [], violao: [], bale: [], hiphop: [], carate: [], jiujitsu: []
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
    if (!gameId || !role) return

    const cleanGameId = gameId.trim().toUpperCase()
    const gameRef = doc(db, 'games', cleanGameId)

    const unsubscribe = onSnapshot(
      gameRef,
      docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data()
          setGameData(data)

          // State synchronization
          if (data.gameState === 'spinning') {
            if (localGameState !== 'spinning') {
              setLocalGameState('spinning')
              if (role === 'student') spinWheel(false)
            }
          } else if (data.gameState === 'question') {
            if (localGameState !== 'question' && localGameState !== 'answered') {
              if (spinIntervalRef.current) clearInterval(spinIntervalRef.current)
              setLocalQuestion(data.currentQuestion)
              setLocalGameState('question')
              setLocalResult(null)
            }
          } else if (data.gameState === 'result') {
            if (localGameState !== 'result') {
              setLocalGameState('result')
            }
          } else if (data.gameState === 'waiting') {
             if (localGameState !== 'waiting') {
                setLocalGameState('waiting')
             }
          }
        } else {
          if (localGameState !== 'menu') {
            alert('A sala foi encerrada pelo professor.')
            resetGame()
          }
        }
      },
      error => console.error('Erro no listener:', error)
    )

    return () => unsubscribe()
  }, [gameId, role, localGameState])

  const createGame = async () => {
    setError(null)
    const newId = nanoid()
    try {
      await setDoc(doc(db, 'games', newId), {
        gameState: 'waiting',
        currentQuestion: null,
        selectedCategory: null,
        players: {},
        createdAt: new Date().toISOString()
      })
      setGameId(newId)
      setRole('teacher')
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
        const currentPlayersCount = Object.keys(data.players || {}).length
        if (currentPlayersCount >= 20) {
          setError('A sala já atingiu o limite de 20 alunos.')
          return
        }
        
        await updateDoc(gameRef, {
          [`players.${playerId}`]: {
            name: playerName,
            score: 0,
            answeredCurrent: false,
            lastCorrect: null
          }
        })
        setRole('student')
        setLocalGameState('waiting')
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
    setRole(null)
    setLocalGameState('menu')
    setLocalQuestion(null)
    setLocalResult(null)
    setError(null)
    setQuestionHistory({
      robotica: [], ingles: [], teclado: [], violao: [], bale: [], hiphop: [], carate: [], jiujitsu: []
    })
  }

  const startRound = async () => {
    if (role !== 'teacher') return
    
    // Reset player answers for the new round
    const updates = {
      gameState: 'spinning',
      currentQuestion: null
    }
    
    if (gameData && gameData.players) {
      Object.keys(gameData.players).forEach(pId => {
        updates[`players.${pId}.answeredCurrent`] = false
        updates[`players.${pId}.lastCorrect`] = null
      })
    }

    await updateDoc(doc(db, 'games', gameId), updates)
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
        if (!gameId || role === 'teacher') {
          await generateQuestion(category)
        }
      }
    }, 2500)
  }

  const generateQuestion = async category => {
    if (!groqClient) return

    const previousQuestions = questionHistory[category.id] || []
    const avoidContext =
      previousQuestions.length > 0
        ? `IMPORTANTE: NÃO repita nenhuma destas perguntas já feitas: [${previousQuestions.join('; ')}].`
        : ''

    let basePrompt = '';

    if (category.id === 'robotica') {
      basePrompt = `Atue como um apresentador de Game Show educacional para alunos de 10 a 15 anos. Gere uma pergunta de nível FÁCIL ou MÉDIO sobre Robótica. 
      O tema da pergunta DEVE ser obrigatoriamente restrito a um destes assuntos: 
      - Programação em blocos (mBlock) e plano cartesiano (X e Y).
      - Lógica de programação: Condicionais complexas (If-Else) e Loops.
      - Eletrônica básica: Montagem de circuitos (LEDs, resistores, botões, bateria) no Tinkercad ou físico.
      - Componentes mecânicos: Uso de Ponte H para controle de motores DC.
      - Projetos práticos: Semáforo eletrônico, Jogo da Memória eletrônico, Robô Vagalume ou Código Morse.`;
    } else if (category.id === 'teclado') {
      basePrompt = `Atue como um apresentador de Game Show educacional para alunos de 10 a 15 anos. Gere uma pergunta de nível BÁSICO e INICIANTE sobre o INSTRUMENTO MUSICAL: Teclado/Piano. 
      ATENÇÃO: NÃO faça perguntas sobre teclado de computador ou informática. Foque em notas musicais, teclas brancas e pretas, acordes básicos ou ritmo.`;
    } else {
      basePrompt = `Atue como um apresentador de Game Show educacional para alunos de 10 a 15 anos. Gere uma pergunta de nível BÁSICO e INICIANTE sobre a modalidade extracurricular: ${category.name}. 
      A pergunta deve focar exclusivamente em fundamentos introdutórios e ser fácil de responder.`;
    }

    const prompt = `${basePrompt}
    ${avoidContext}
    INSTRUÇÕES CRÍTICAS DE PRECISÃO:
    - A "respostaCorreta" DEVE ser um fato indiscutível e verificável.
    - NÃO invente informações. 
    - As 3 alternativas incorretas devem ser plausíveis, mas factualmente erradas.
    
    Responda APENAS um JSON neste formato exato, sem markdown: 
    {"pergunta": "Texto da pergunta", "alternativas": ["Opção A", "Opção B", "Opção C", "Opção D"], "respostaCorreta": "Texto exato da opção correta", "categoria": "${category.id}"}.
    Idioma: Português do Brasil.
    Não traduza a categoria.`;

    try {
      const completion = await groqClient.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        temperature: 0.2 // Reduzido de 0.7 para 0.2 para evitar alucinações e focar em fatos.
      })

      const content = JSON.parse(completion.choices[0]?.message?.content)

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
        await updateDoc(doc(db, 'games', gameId), { gameState: 'waiting' })
      else setLocalGameState('idle')
    }
  }

  const handleAnswer = async answer => {
    if (!localQuestion) return
    const isCorrect = answer === localQuestion.respostaCorreta

    if (gameId && role === 'student') {
      try {
        // Optimistic UI update
        setLocalGameState('answered')
        
        await updateDoc(doc(db, 'games', gameId), {
          [`players.${playerId}.answeredCurrent`]: true,
          [`players.${playerId}.lastCorrect`]: isCorrect,
          [`players.${playerId}.score`]: increment(isCorrect ? 1 : 0)
        })
      } catch (e) {
        console.error('Erro ao enviar resposta:', e)
        setError('Erro ao enviar resposta.')
        setLocalGameState('question') // Revert if failed
      }
    } else if (!gameId) {
      // Solo Mode
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

  const showResults = async () => {
    if (role !== 'teacher') return
    await updateDoc(doc(db, 'games', gameId), {
      gameState: 'result'
    })
  }

  // Auto-close question if everyone has answered
  useEffect(() => {
    if (role === 'teacher' && gameData && gameData.gameState === 'question') {
      const playersList = Object.values(gameData.players || {})
      if (playersList.length > 0) {
        const allAnswered = playersList.every(p => p.answeredCurrent === true)
        if (allAnswered) {
          showResults()
        }
      }
    }
  }, [gameData, role])

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
        <FontAwesomeIcon icon={cat.icon} className='text-white text-xl sm:text-2xl' />
      </div>
      <span className='text-white font-bold text-xs sm:text-sm uppercase tracking-wider text-center'>
        {cat.name}
      </span>
      {localGameState !== 'spinning' && !gameId && (
        <span className='text-[10px] sm:text-xs font-mono mt-1 text-white/80'>
          Lvl {soloScores[cat.id]}
        </span>
      )}
    </div>
  )

  const playersList = gameData && gameData.players ? Object.values(gameData.players) : []
  const answeredCount = playersList.filter(p => p.answeredCurrent).length

  return (
    <div className='h-screen w-full bg-gray-900 text-white font-sans flex flex-col overflow-hidden'>
      {/* HEADER FIXO */}
      <header className='flex-shrink-0 w-full p-4 sm:p-6 flex flex-col items-center bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 shadow-md z-20'>
        <div className='flex items-center gap-3'>
          <FontAwesomeIcon icon={faBrain} className='text-3xl sm:text-4xl text-blue-500' />
          <h1 className='text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-pink-500 tracking-tight'>
            QUESTIONADOS
          </h1>
        </div>
        {gameId && (
          <div className='mt-2 px-3 py-1 bg-gray-700 rounded-full text-[10px] sm:text-xs font-mono text-gray-300 flex items-center gap-2'>
            <span>SALA: <strong className='text-white'>{gameId}</strong></span>
            {role === 'teacher' && <span className='bg-blue-600 px-2 rounded ml-2'>PROFESSOR</span>}
            {role === 'student' && <span className='bg-green-600 px-2 rounded ml-2'>ALUNO</span>}
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
              <button onClick={() => setError(null)} className='ml-4 underline text-xs'>
                Fechar
              </button>
            </div>
          )}

          {/* MENU */}
          {localGameState === 'menu' && (
            <div className='w-full max-w-md space-y-6'>
              
              <div className='bg-gray-800 p-6 sm:p-8 rounded-3xl shadow-2xl border border-gray-700 text-center'>
                <h2 className='text-xl sm:text-2xl font-bold mb-4 text-green-400 flex justify-center items-center gap-2'>
                  <FontAwesomeIcon icon={faUserGraduate} /> Sou Aluno
                </h2>
                <div className='space-y-4'>
                  <input
                    className='w-full bg-gray-900/50 border border-gray-600 p-3 sm:p-4 rounded-xl text-white focus:border-green-500 outline-none text-center font-bold text-base sm:text-lg'
                    placeholder='Seu Apelido'
                    value={playerName}
                    onChange={e => setPlayerName(e.target.value)}
                  />
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
                </div>
              </div>

              <div className='bg-gray-800 p-6 sm:p-8 rounded-3xl shadow-2xl border border-gray-700 text-center'>
                <h2 className='text-xl sm:text-2xl font-bold mb-4 text-blue-400 flex justify-center items-center gap-2'>
                  <FontAwesomeIcon icon={faChalkboardTeacher} /> Sou Professor
                </h2>
                <button
                  onClick={createGame}
                  className='w-full py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl font-bold text-base sm:text-lg shadow-lg hover:scale-[1.02] transition-transform'
                >
                  Criar Nova Sala
                </button>
              </div>

              <div className='text-center mt-4'>
                <button
                  onClick={() => setLocalGameState('idle')}
                  className='text-xs sm:text-sm text-gray-500 hover:text-white underline'
                >
                  Jogar Modo Solo (Offline)
                </button>
              </div>

            </div>
          )}

          {/* WAITING (Lobby) */}
          {localGameState === 'waiting' && gameId && (
            <div className='text-center w-full max-w-2xl animate-fade-in'>
              {role === 'teacher' ? (
                <>
                  <h2 className='text-2xl sm:text-3xl font-bold mb-2'>Sala de Aula Criada!</h2>
                  <p className='text-gray-400 mb-6 text-sm sm:text-base'>
                    Peça para os alunos entrarem com o código:
                  </p>
                  <div className='bg-gray-800 border-2 border-dashed border-gray-600 rounded-xl p-4 sm:p-6 mb-8 inline-block w-full max-w-sm'>
                    <span
                      className='text-4xl sm:text-5xl font-mono font-black tracking-[0.2em] text-white select-all cursor-pointer block'
                      onClick={() => navigator.clipboard.writeText(gameId)}
                    >
                      {gameId}
                    </span>
                  </div>

                  <div className='mb-8'>
                    <h3 className='text-lg font-bold text-blue-400 mb-4'>Alunos na Sala ({playersList.length}/20)</h3>
                    <div className='flex flex-wrap justify-center gap-3'>
                      {playersList.length === 0 ? (
                        <span className='text-gray-500 italic'>Aguardando alunos entrarem...</span>
                      ) : (
                        playersList.map((p, idx) => (
                          <div key={idx} className='bg-gray-700 px-4 py-2 rounded-full font-medium shadow flex items-center gap-2'>
                            <FontAwesomeIcon icon={faUserGraduate} className='text-gray-400' />
                            {p.name}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <button
                    onClick={startRound}
                    disabled={playersList.length === 0}
                    className='block w-full max-w-md mx-auto bg-green-500 disabled:bg-gray-600 hover:bg-green-400 text-white py-3 sm:py-4 rounded-xl font-black text-lg sm:text-xl shadow-lg transition-all'
                  >
                    INICIAR PRIMEIRA RODADA
                  </button>
                </>
              ) : (
                <>
                  <div className='inline-block p-4 sm:p-6 bg-gray-800 rounded-full mb-6 animate-pulse'>
                    <FontAwesomeIcon icon={faUserGroup} className='text-3xl sm:text-5xl text-blue-400' />
                  </div>
                  <h2 className='text-2xl sm:text-3xl font-bold mb-2'>Você está na sala!</h2>
                  <p className='text-yellow-500 font-medium animate-pulse text-sm sm:text-base mb-8'>
                    Aguardando o professor iniciar a aula...
                  </p>
                  <div className='bg-gray-800 rounded-xl p-4 inline-block shadow'>
                    <span className='text-gray-400 text-sm'>Seu apelido:</span>
                    <div className='text-xl font-bold text-green-400'>{playerName}</div>
                  </div>
                </>
              )}

              <button onClick={resetGame} className='mt-8 sm:mt-12 block mx-auto text-gray-500 hover:text-red-400 text-sm'>
                Encerrar / Sair da Sala
              </button>
            </div>
          )}

          {/* SPINNING */}
          {localGameState === 'spinning' && (
            <div className='w-full flex flex-col items-center'>
              <div className='grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10 w-full max-w-2xl'>
                {categories.map((cat, i) => renderCategoryCard(cat, spinningIndex === i))}
              </div>

              <div className='bg-gray-800 px-6 py-4 sm:px-8 sm:py-6 rounded-2xl border border-gray-700 shadow-2xl text-center max-w-lg animate-pulse w-full'>
                <h3 className='text-lg sm:text-xl font-bold text-white mb-2'>
                  Sorteando Modalidade...
                </h3>
                <p className='text-blue-400 font-medium text-sm sm:text-base'>
                  A Inteligência Artificial está criando um desafio exclusivo para a turma...
                </p>
              </div>
            </div>
          )}

          {/* QUESTION */}
          {localGameState === 'question' && localQuestion && (
            <div className='w-full max-w-3xl animate-slide-up flex flex-col items-center'>
              
              <div className='flex justify-center -mb-5 sm:-mb-6 relative z-10'>
                <div
                  className={`${
                    categories.find(c => c.id === (localQuestion.categoria || 'robotica'))?.color || 'bg-gray-500'
                  } px-6 py-2 sm:px-8 sm:py-3 rounded-full shadow-lg flex items-center gap-2 sm:gap-3`}
                >
                  <FontAwesomeIcon
                    icon={categories.find(c => c.id === (localQuestion.categoria || 'robotica'))?.icon}
                    className='text-sm sm:text-base'
                  />
                  <span className='font-black uppercase tracking-wider text-xs sm:text-sm'>
                    {categories.find(c => c.id === (localQuestion.categoria || 'robotica'))?.name}
                  </span>
                </div>
              </div>

              <div className='w-full bg-gray-800 pt-8 pb-6 px-4 sm:pt-10 sm:pb-8 sm:px-8 rounded-3xl shadow-2xl border border-gray-700'>
                <h3 className='text-lg sm:text-2xl font-bold text-center mb-6 sm:mb-8 leading-relaxed text-gray-100'>
                  {localQuestion.pergunta}
                </h3>

                {/* VISÃO ALUNO */}
                {role === 'student' && (
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
                )}

                {/* VISÃO PROFESSOR OU SOLO */}
                {(role === 'teacher' || !gameId) && (
                  <>
                    <div className='grid grid-cols-1 gap-3 opacity-60 pointer-events-none'>
                      {localQuestion.alternativas.map((alt, idx) => (
                        <div key={idx} className='bg-gray-700 border border-gray-600 p-4 sm:p-5 rounded-xl text-left'>
                          <span className='font-medium text-base sm:text-lg'>
                            {alt}
                          </span>
                        </div>
                      ))}
                    </div>
                    {role === 'teacher' && (
                      <div className='mt-8 flex flex-col items-center border-t border-gray-700 pt-6'>
                        <div className='text-lg mb-4 font-bold text-gray-300'>
                          Progresso das Respostas: <span className='text-blue-400'>{answeredCount} / {playersList.length}</span>
                        </div>
                        {/* Barra de progresso */}
                        <div className='w-full bg-gray-700 rounded-full h-3 mb-6 overflow-hidden'>
                          <div 
                            className='bg-blue-500 h-3 rounded-full transition-all duration-500' 
                            style={{ width: `${playersList.length > 0 ? (answeredCount / playersList.length) * 100 : 0}%` }}>
                          </div>
                        </div>
                        <button
                          onClick={showResults}
                          className='w-full sm:w-auto px-8 py-3 sm:py-4 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl'
                        >
                          Encerrar e Mostrar Resultado
                        </button>
                      </div>
                    )}
                  </>
                )}
                {/* RESPONDER SOLO MODE */}
                {!gameId && (
                  <div className='grid grid-cols-1 gap-3 mt-3'>
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
                )}
              </div>
            </div>
          )}

          {/* ANSWERED (Student Waiting for Teacher to show results) */}
          {localGameState === 'answered' && role === 'student' && (
            <div className='text-center animate-fade-in mt-10'>
              <div className='inline-block p-4 sm:p-6 bg-gray-800 rounded-full mb-6'>
                <FontAwesomeIcon icon={faCheckCircle} className='text-5xl text-blue-500' />
              </div>
              <h2 className='text-2xl sm:text-3xl font-bold mb-4'>Resposta Registrada!</h2>
              <p className='text-gray-400 animate-pulse text-lg'>Aguardando o professor encerrar o tempo...</p>
            </div>
          )}

          {/* RESULT */}
          {localGameState === 'result' && (
            <div className='text-center animate-scale-in w-full max-w-2xl px-2 sm:px-4'>
              
              {/* SOLO MODE RESULT */}
              {!gameId && (
                <>
                  <div className='mb-4 sm:mb-6'>
                    {localResult === 'correct' ? (
                      <FontAwesomeIcon icon={faCheckCircle} className='text-6xl sm:text-8xl text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]' />
                    ) : (
                      <FontAwesomeIcon icon={faTimesCircle} className='text-6xl sm:text-8xl text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]' />
                    )}
                  </div>
                  <h2 className='text-3xl sm:text-4xl font-black mb-2'>
                    {localResult === 'correct' ? 'RESPOSTA CORRETA!' : 'QUE PENA!'}
                  </h2>
                  {localResult === 'incorrect' && localQuestion && (
                    <div className='bg-gray-800/80 border border-green-500/30 p-4 rounded-xl mb-8 w-full inline-block'>
                      <div className='flex items-center justify-center gap-2 text-green-400 mb-2'>
                        <FontAwesomeIcon icon={faLightbulb} />
                        <span className='text-xs font-bold uppercase tracking-widest'>A resposta correta era:</span>
                      </div>
                      <p className='text-white font-black text-lg sm:text-xl'>{localQuestion.respostaCorreta}</p>
                    </div>
                  )}
                  <div className='grid grid-cols-4 sm:grid-cols-8 gap-2 sm:gap-3 mb-8 w-full'>
                    {categories.map(cat => (
                      <div key={cat.id} className='p-2 rounded-xl bg-gray-800 flex flex-col items-center'>
                        <span className='text-xs font-bold text-white'>{soloScores[cat.id]}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => spinWheel(true)}
                    className='w-full sm:w-auto px-8 py-3 sm:py-4 bg-white text-gray-900 rounded-full font-bold text-lg hover:scale-105 transition-transform'
                  >
                    Continuar Jogando
                  </button>
                  <button
                    onClick={() => setLocalGameState('menu')}
                    className='block w-full mt-4 text-gray-500 text-sm hover:text-white'
                  >
                    Voltar ao Menu
                  </button>
                </>
              )}

              {/* CLASSROOM RESULT */}
              {gameId && (
                <>
                  {role === 'teacher' && (
                    <div className='mb-8 w-full max-w-lg mx-auto'>
                      <h2 className='text-3xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400'>
                        Ranking da Turma
                      </h2>
                      {localQuestion && (
                        <div className='bg-gray-800/80 border border-green-500/30 p-4 rounded-xl mb-6'>
                           <p className='text-gray-400 text-xs mb-1 uppercase tracking-wider'>A resposta correta era:</p>
                           <p className='text-green-400 font-black text-lg'>{localQuestion.respostaCorreta}</p>
                        </div>
                      )}
                      
                      <div className='bg-gray-800 rounded-2xl overflow-hidden border border-gray-700 max-h-[40vh] overflow-y-auto mb-6'>
                        {playersList.sort((a,b) => b.score - a.score).map((p, index) => (
                          <div key={index} className={`flex justify-between items-center p-4 border-b border-gray-700/50 ${index === 0 ? 'bg-yellow-500/10' : ''}`}>
                            <div className='flex items-center gap-3'>
                              <span className={`font-bold w-6 text-center ${index === 0 ? 'text-yellow-500 text-xl' : 'text-gray-500'}`}>
                                {index + 1}º
                              </span>
                              <span className='font-bold text-lg'>{p.name}</span>
                            </div>
                            <div className='flex items-center gap-4'>
                              {p.lastCorrect === true && <span className='text-green-500 font-bold'>+1 <FontAwesomeIcon icon={faCheckCircle}/></span>}
                              {p.lastCorrect === false && <span className='text-red-500 font-bold'><FontAwesomeIcon icon={faTimesCircle}/></span>}
                              <div className='bg-gray-900 px-4 py-1 rounded-full font-mono text-blue-400 font-bold min-w-[3rem] text-center'>
                                {p.score}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={startRound}
                        className='mt-4 w-full sm:w-auto px-8 py-3 sm:py-4 bg-white text-gray-900 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl'
                      >
                        Próxima Rodada <FontAwesomeIcon icon={faTrophy} className='ml-2' />
                      </button>
                    </div>
                  )}

                  {role === 'student' && (
                    <div className='mt-6'>
                      {/* Check if player got it right */}
                      {gameData?.players?.[playerId]?.lastCorrect === true ? (
                        <>
                          <FontAwesomeIcon icon={faCheckCircle} className='text-6xl sm:text-8xl text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.5)] mb-6' />
                          <h2 className='text-3xl font-black mb-2'>VOCÊ ACERTOU!</h2>
                        </>
                      ) : gameData?.players?.[playerId]?.lastCorrect === false ? (
                        <>
                          <FontAwesomeIcon icon={faTimesCircle} className='text-6xl sm:text-8xl text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)] mb-6' />
                          <h2 className='text-3xl font-black mb-2'>VOCÊ ERROU!</h2>
                        </>
                      ) : (
                         <h2 className='text-2xl font-black mb-2 text-gray-400 mt-6'>TEMPO ESGOTADO!</h2>
                      )}

                      <div className='bg-gray-800 p-6 rounded-2xl mt-8 inline-block shadow-lg border border-gray-700'>
                         <span className='text-gray-400 text-sm'>Sua Pontuação Total</span>
                         <div className='text-5xl font-black text-blue-400 mt-2'>{gameData?.players?.[playerId]?.score || 0}</div>
                      </div>

                      <p className='text-sm text-gray-500 mt-8 animate-pulse'>Aguardando o professor iniciar a próxima rodada...</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* IDLE SOLO */}
          {localGameState === 'idle' && !gameId && (
            <div className='flex flex-col items-center w-full'>
              <div className='grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-10 sm:mb-12 w-full max-w-2xl'>
                {categories.map(cat => (
                  <div key={cat.id} className='bg-gray-800/50 p-3 sm:p-4 rounded-xl border border-gray-700 flex flex-col items-center'>
                    <FontAwesomeIcon icon={cat.icon} className={`${cat.textColor} text-xl sm:text-2xl mb-1 sm:mb-2`} />
                    <span className='text-[10px] sm:text-xs text-gray-400 uppercase'>{cat.name}</span>
                    <span className='text-lg sm:text-xl font-bold'>{soloScores[cat.id]}</span>
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
                onClick={() => setLocalGameState('menu')}
                className='mt-8 text-sm text-gray-500 hover:text-white transition-colors underline'
              >
                Voltar ao Menu Principal
              </button>
            </div>
          )}

        </div>
      </main>

      {/* FOOTER FIXO */}
      <footer className='flex-shrink-0 w-full py-4 text-center text-gray-600 text-xs sm:text-sm border-t border-gray-800 bg-gray-900 z-20'>
        <p>Criado com propósito educacional • Powered by Groq AI</p>
      </footer>

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes scale-in { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
        .animate-slide-up { animation: slide-up 0.5s ease-out; }
        .animate-scale-in { animation: scale-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}
